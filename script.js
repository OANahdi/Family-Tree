// ================= Local Storage System =================
let familyData = JSON.parse(localStorage.getItem("myFamilyTree")) || [
    { id: 1, name: "Root Ancestor", gender: "M", fatherId: null, mother: null }
];

function saveToLocal() {
    localStorage.setItem("myFamilyTree", JSON.stringify(familyData));
}

// ================= Canvas & Camera Setup =================
const width = window.innerWidth;
const height = window.innerHeight;

const svg = d3.select("#tree-container").append("svg")
    .attr("width", width).attr("height", height);

const g = svg.append("g");
const zoom = d3.zoom().scaleExtent([0.1, 3]).on("zoom", (event) => { g.attr("transform", event.transform); });
svg.call(zoom);

const treeGroup = g.append("g").attr("transform", `translate(${width/2}, 100)`);
const linksLayer = treeGroup.append("g"); 
const nodesLayer = treeGroup.append("g"); 

const treeLayout = d3.tree().nodeSize([160, 140]); 

let activeNodeId = null;
let nodeToAddChildTo = null;
let nodeToEdit = null;
let currentRoot = null; 

let isSelectingMother = false;
let childIdForMother = null;

// ================= Theme Toggle =================
window.toggleTheme = function() {
    const body = document.body;
    const currentTheme = body.getAttribute("data-theme");
    const toggleBtn = document.getElementById("theme-toggle");
    
    if (currentTheme === "dark") {
        body.removeAttribute("data-theme");
        toggleBtn.innerText = "🌙 Dark Mode";
    } else {
        body.setAttribute("data-theme", "dark");
        toggleBtn.innerText = "☀️ Light Mode";
    }
}

// ================= Tree Update =================
function update() {
    const treeNodes = familyData.filter(d => d.fatherId !== null || d.id === 1);
    currentRoot = d3.stratify().id(d => d.id).parentId(d => d.fatherId)(treeNodes);
    treeLayout(currentRoot);

    const link = linksLayer.selectAll(".link").data(currentRoot.links(), d => d.target.id);
    link.exit().transition().duration(400).style("opacity", 0).remove();

    const linkEnter = link.enter().append("path")
        .attr("class", "link").attr("fill", "none")
        .attr("stroke", "var(--line-color)").attr("stroke-width", 2.5)
        .attr("d", d => {
            const o = {x: d.source.x, y: d.source.y};
            return d3.linkVertical().x(d => d.x).y(d => d.y)({source: o, target: o});
        });

    link.merge(linkEnter).transition().duration(600)
        .attr("stroke", "var(--line-color)")
        .attr("d", d3.linkVertical().x(d => d.x).y(d => d.y));

    const node = nodesLayer.selectAll(".node").data(currentRoot.descendants(), d => d.id);
    node.exit().transition().duration(400).style("opacity", 0).remove();

    const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.parent ? d.parent.x : d.x},${d.parent ? d.parent.y : d.y})`)
        .style("cursor", "pointer").style("opacity", 0)
        .style("--node-glow", d => d.data.gender === "M" ? "var(--male-glow)" : "var(--female-glow)")
        .on("click", handleNodeClick)
        .on("dblclick", (event, d) => {
            event.stopPropagation();
            focusNode(d.id); 
        });

    nodeEnter.append("rect")
        .attr("width", 130).attr("height", 46).attr("x", -65).attr("y", -23).attr("rx", 10)
        .attr("stroke", "var(--bg-color)").attr("stroke-width", 3);

    nodeEnter.append("text")
        .attr("dy", 6).attr("text-anchor", "middle").attr("fill", "#ffffff")
        .style("font-size", "15px").style("font-weight", "600");

    const nodeUpdate = node.merge(nodeEnter);
    nodeUpdate.transition().duration(600).attr("transform", d => `translate(${d.x},${d.y})`).style("opacity", 1);
    nodeUpdate.select("rect").transition().duration(600).attr("fill", d => d.data.gender === "M" ? "var(--male-bg)" : "var(--female-bg)").attr("stroke", "var(--bg-color)");
    nodeUpdate.select("text").text(d => d.data.name);
    
    nodesLayer.selectAll(".node").classed("active", d => d.id === activeNodeId);
}

// ================= Interactions & Tooltip =================
function handleNodeClick(event, d) {
    event.stopPropagation(); 
    const person = d.data;

    if (isSelectingMother) {
        if (person.gender === "M") return alert("Cannot select a male as a mother!");
        if (person.id === childIdForMother) return alert("A person cannot be their own mother!");
        const childNode = familyData.find(x => x.id === childIdForMother);
        childNode.mother = person.id;
        isSelectingMother = false;
        document.getElementById("selection-banner").classList.add("hidden");
        saveToLocal(); update(); return;
    }

    const tooltip = d3.select("#node-tooltip");
    if (activeNodeId === person.id) { tooltip.classed("show", false); activeNodeId = null; nodesLayer.selectAll(".node").classed("active", false); return; }
    
    activeNodeId = person.id;
    nodesLayer.selectAll(".node").classed("active", nodeData => nodeData.id === activeNodeId);

    let motherName = "Not registered"; let isMotherInTree = false;
    if (person.mother !== null) {
        if (typeof person.mother === "string") motherName = person.mother + " (Outside Tree)";
        else if (typeof person.mother === "number") {
            const motherNode = familyData.find(m => m.id === person.mother);
            if(motherNode) { motherName = motherNode.name; isMotherInTree = true; }
        }
    }

    let motherHtml = `<span style="color: var(--female-bg); font-weight: 600;">${motherName}</span>`;
    if (isMotherInTree) motherHtml = `<span style="color: var(--female-bg); font-weight: 600; text-decoration: underline; cursor: pointer;" onclick="focusNode(${person.mother})">📍 ${motherName}</span>`;

    tooltip.html(`
        <div style="color: var(--male-bg); font-size: 17px; font-weight: 700; margin-bottom: 6px;">${person.name}</div>
        <div style="font-size: 14px; margin-bottom: 10px;">Mother: ${motherHtml}</div>
        <button class="add-child-btn" onclick="openAddModal(${person.id})">Add Member</button>
        <button class="mother-btn" onclick="openMotherModal(${person.id})">Add/Edit Mother</button>
        <div class="action-buttons">
            <button class="edit-btn" onclick="openEditModal(${person.id})">Edit</button>
            <button class="delete-btn" onclick="deleteNode(${person.id})">Delete</button>
        </div>
    `);

    const nodeElement = event.currentTarget;
    const bbox = nodeElement.getBoundingClientRect();
    tooltip.style("left", (bbox.left + bbox.width / 2) + "px").style("top", bbox.top + "px").classed("show", true);
}

window.focusNode = function(id) {
    if (!currentRoot) return;
    const targetNode = currentRoot.descendants().find(d => d.id == id);
    if (targetNode) {
        const scale = 1.2;
        const actualX = targetNode.x + (width / 2); const actualY = targetNode.y + 100;
        const tx = (width / 2) - (actualX * scale); const ty = (height / 2) - (actualY * scale);
        svg.transition().duration(800).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        d3.select("#node-tooltip").classed("show", false); activeNodeId = null; nodesLayer.selectAll(".node").classed("active", false);
    }
}

svg.on("click", function() { d3.select("#node-tooltip").classed("show", false); activeNodeId = null; nodesLayer.selectAll(".node").classed("active", false); });

// ================= Export & Safe Backup Tools for iPad =================

window.exportImage = function() {
    d3.select("#node-tooltip").classed("show", false);
    const ui = document.getElementById("ui-container");
    const importModal = document.getElementById("import-modal");
    
    ui.style.display = "none";
    if (importModal) importModal.style.display = "none";
    
    const currentTransform = d3.zoomTransform(svg.node());
    const bounds = treeGroup.node().getBBox();
    const fullWidth = bounds.width || 1; const fullHeight = bounds.height || 1;
    
    const scale = Math.min((width - 150) / fullWidth, (height - 150) / fullHeight, 1);
    const cx = bounds.x + (fullWidth / 2) + (width / 2);
    const cy = bounds.y + (fullHeight / 2) + 100;
    const tx = (width / 2) - (cx * scale); const ty = (height / 2) - (cy * scale);
    
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

    setTimeout(() => {
        html2canvas(document.body, { 
            backgroundColor: getComputedStyle(document.body).backgroundColor,
            scale: 2, scrollX: 0, scrollY: 0
        }).then(canvas => {
            ui.style.display = "block";
            if (importModal) importModal.style.display = "";
            svg.call(zoom.transform, currentTransform);
            
            const imgData = canvas.toDataURL("image/png");
            let imgModal = document.createElement("div");
            imgModal.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.95); display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:1000; font-family:sans-serif;";
            imgModal.innerHTML = `
                <p style="color:#40e0d0; margin-bottom:15px; font-weight:bold; font-size:16px;">📸 Long press the image to save it to your camera roll</p>
                <img src="${imgData}" style="max-width:90%; max-height:75%; border:2px solid #40e0d0; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
                <button onclick="this.parentElement.remove()" style="margin-top:20px; padding:12px 30px; background:#e74c3c; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:15px;">Close Preview</button>
            `;
            document.body.appendChild(imgModal);
        });
    }, 500); 
}

// ================= Radical Solution for Text Truncation on iPad =================
window.tempBackupStr = ""; 

window.exportData = function() {
    const jsonStr = JSON.stringify(familyData, null, 2);
    window.tempBackupStr = jsonStr; // Store text in memory for safe copying
    
    let dataModal = document.createElement("div");
    dataModal.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:1000; font-family:sans-serif;";
    dataModal.innerHTML = `
        <div style="background:#1c2a43; border:1px solid #40e0d0; padding:25px; border-radius:12px; width:320px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.5);">
            <h3 style="color:#40e0d0; margin-bottom:10px;">💾 Backup Data</h3>
            <p style="font-size:13px; color:#cbd5e1; margin-bottom:15px;">Click the button to copy the code and save it in your notes</p>
            <textarea id="backup-text" style="width:100%; height:110px; background:#0b132b; color:white; border:1px solid #34495e; border-radius:6px; padding:8px; font-family:monospace; font-size:11px; direction:ltr;" readonly>${jsonStr}</textarea>
            <button onclick="copySafeForIOS()" style="width:100%; margin-top:12px; padding:10px; background:#2ecc71; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">📋 Copy Full Code</button>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:8px; padding:10px; background:#e74c3c; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Close</button>
        </div>
    `;
    document.body.appendChild(dataModal);
}

// Copy algorithm that bypasses Safari restrictions
window.copySafeForIOS = function() {
    const str = window.tempBackupStr;
    
    // Attempt modern copy technique
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(str).then(() => {
            alert('🚀 Full code copied successfully!');
        }).catch(err => { fallbackCopy(str); });
    } else {
        fallbackCopy(str);
    }
}

// Fallback copy technique for iPad (via huge hidden textarea)
window.fallbackCopy = function(str) {
    let textArea = document.createElement("textarea");
    textArea.value = str;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px"; // Completely hide the box
    textArea.style.top = "-9999px";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand("copy");
        alert("🚀 Full code copied successfully!");
    } catch (err) {
        alert("Auto-copy failed, please copy the text manually from the box.");
    }
    
    textArea.remove();
}

// ================= Import Modals =================
window.openImportModal = function() { document.getElementById("import-modal").classList.remove("hidden"); }
window.closeImportModal = function() { document.getElementById("import-modal").classList.add("hidden"); }
window.importFromFile = function(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { processImportedJson(e.target.result); }; reader.readAsText(file); event.target.value = ''; }
window.importFromText = function() { const text = document.getElementById("import-text").value; if (text.trim() === "") return alert("Please paste the text first!"); processImportedJson(text); }

function processImportedJson(jsonString) {
    try {
        const importedData = JSON.parse(jsonString);
        if (Array.isArray(importedData) && importedData.length > 0) {
            familyData = importedData; saveToLocal(); 
            linksLayer.selectAll("*").remove(); nodesLayer.selectAll("*").remove(); // Immediate cleanup
            update(); closeImportModal(); document.getElementById("import-text").value = "";
            alert("🎉 Tree restored successfully!");
        } else { alert("The file does not contain a valid tree structure."); }
    } catch (err) { alert("Error! Make sure you copied the entire code without missing anything."); }
}

// ================= Remaining Modal Functions =================
window.openAddModal = function(parentId) { nodeToAddChildTo = parentId; document.getElementById("add-modal").classList.remove("hidden"); d3.select("#node-tooltip").classed("show", false); }
window.closeAddModal = function() { document.getElementById("add-modal").classList.add("hidden"); document.getElementById("new-name").value = ""; }
window.saveNewNode = function() {
    const name = document.getElementById("new-name").value; const gender = document.getElementById("new-gender").value;
    if (name.trim() !== "") { const newId = Math.max(...familyData.map(d => d.id)) + 1; familyData.push({ id: newId, name: name, gender: gender, fatherId: nodeToAddChildTo, mother: null }); saveToLocal(); closeAddModal(); update(); }
}
window.openEditModal = function(id) { nodeToEdit = familyData.find(d => d.id === id); document.getElementById("edit-name").value = nodeToEdit.name; document.getElementById("edit-gender").value = nodeToEdit.gender; document.getElementById("edit-modal").classList.remove("hidden"); d3.select("#node-tooltip").classed("show", false); }
window.closeEditModal = function() { document.getElementById("edit-modal").classList.add("hidden"); }
window.saveEditNode = function() { const newName = document.getElementById("edit-name").value; const newGender = document.getElementById("edit-gender").value; if (newName.trim() !== "") { nodeToEdit.name = newName; nodeToEdit.gender = newGender; saveToLocal(); closeEditModal(); update(); } }
window.deleteNode = function(id) { if (id === 1) return alert("Cannot delete the Root Ancestor!"); if (confirm("Are you sure you want to delete this member and all their descendants?")) { let idsToRemove = new Set([id]); let size = 0; while (idsToRemove.size !== size) { size = idsToRemove.size; familyData.forEach(d => { if (idsToRemove.has(d.fatherId)) idsToRemove.add(d.id); }); } familyData = familyData.filter(d => !idsToRemove.has(d.id)); d3.select("#node-tooltip").classed("show", false); activeNodeId = null; saveToLocal(); update(); } }
window.openMotherModal = function(id) { childIdForMother = id; document.getElementById("mother-modal").classList.remove("hidden"); document.getElementById("outside-mother-name").value = ""; d3.select("#node-tooltip").classed("show", false); }
window.closeMotherModal = function() { document.getElementById("mother-modal").classList.add("hidden"); }
window.selectMotherFromTree = function() { isSelectingMother = true; document.getElementById("mother-modal").classList.add("hidden"); document.getElementById("selection-banner").classList.remove("hidden"); }
window.cancelSelection = function() { isSelectingMother = false; document.getElementById("selection-banner").classList.add("hidden"); }
window.saveOutsideMother = function() { const name = document.getElementById("outside-mother-name").value; if (name.trim() !== "") { const childNode = familyData.find(d => d.id === childIdForMother); childNode.mother = name; saveToLocal(); closeMotherModal(); update(); } }

update();
