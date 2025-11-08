let width_bubbles = document.getElementById("school-vis").getBoundingClientRect().width;
let height_bubbles = document.getElementById("school-vis").getBoundingClientRect().height;
const svg_bubbles = d3.select("#school-vis").append("svg")
    .attr("width", width_bubbles)
    .attr("height", height_bubbles)
    .style("background", "#06283D")
    .style("border-radius", "20rem");

let selected_item = null;

document.getElementById("school-vis").style.display = "none";


// Add chart title
const bubble_chart_title = svg_bubbles.append("text")
    .attr("x", width_bubbles / 2)
    .attr("y", 40) // adjust as needed
    .attr("text-anchor", "middle")
    .attr("class", "chart-title")
    .attr("fill", "white")
    .attr("font-size", "32px")
    .text("title");

// Add chart subtitle
const bubble_chart_subtitle = svg_bubbles.append("text")
    .attr("x", width_bubbles / 2)
    .attr("y", 70) // slightly below the title
    .attr("text-anchor", "middle")
    .attr("class", "chart-subtitle")
    .attr("fill", "white")
    .attr("font-size", "20px")
    .text("Click on the schools you are interested in to learn more!");

// Radius for all bubbles (can customize per-bubble)
const r = 120;

// Bubble simulation
function runSimulation(data) {
    const sim = d3.forceSimulation(data)
        .force("center", d3.forceCenter(width_bubbles/2, height_bubbles/2))
        .force("collision", d3.forceCollide(r + 2))
        .force("charge", d3.forceManyBody().strength(1))
        // .force("boundingX", d3.forceX(width/2).strength(0.2))
        // .force("boundingY", d3.forceY(height/2).strength(0.2))
        .stop();

    // Run enough steps to let bubbles settle
    for (let i = 0; i < 150; ++i) sim.tick();

    for (let d of data) {
        d.x = Math.max(r, Math.min(width - r, d.x));
        d.y = Math.max(r, Math.min(height - r, d.y));
    }

    return data;
}


function updateChart(data) {
    // Simulate positions FIRST!
    runSimulation(data);

    // DATA JOIN
    const circles = svg_bubbles.selectAll("circle")
        .data(data, d => d.text);

    // EXIT
    circles.exit()
        .transition()
        .duration(800)
        .attr("r", 0)
        .style("opacity", 0)
        .remove();

    // ENTER
    const enter = circles.enter().append("circle")
        .attr("cx", width_bubbles/2).attr("cy", height_bubbles/2)
        .attr("r", 0)
        .attr("fill", d => d.isRed ? "#F98B87" : "deepskyblue")
        .attr("stroke", d => {
            if (!selected_item || d.text !== selected_item.text) {
                return "#fff";
            } else {
                return "orange";
            }
        })
        .attr("stroke-width", d => {
            if (!selected_item || d.text !== selected_item.text) {
                return 0.0;
            } else {
                return 15.0;
            }
        })
        .style("opacity", 0)
        .on("click", function(event, d) {
            selected_item = d;
            if (selected_item) {
                updateSchoolInfo(selected_item.raw);
                document.getElementById("school-info").scrollIntoView({ behavior: 'smooth' });
            } else {
                document.getElementById("school-info").style.display = "none";
            }
            UpdateVisuals();
        });

    enter.transition()
        .duration(800)
        .attr("r", r)
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .style("opacity", 1);

    // UPDATE
    circles.transition()
        .duration(800)
        .attr("stroke", d => {
            if (!selected_item || d.text !== selected_item.text) {
                return "#fff";
            } else {
                return "orange";
            }
        })
        .attr("stroke-width", d => {
            if (!selected_item || d.text !== selected_item.text) {
                return 0.0;
            } else {
                return 15.0;
            }
        })
        .attr("fill", d => d.isRed ? "#F98B87" : "deepskyblue");


    // TEXT LABELS
    const labels = svg_bubbles.selectAll(".bubble-label")
        .data(data, d => d.text);

    labels.exit()
        .transition()
        .duration(800)
        .style("opacity", 0)
        .remove();

    const labelEnter = labels.enter()
        .append("text")
        .attr("class", "bubble-label")
        .attr("x", width/2)
        .attr("y", height/2)
        .style("opacity", 0)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .text(d => d.text);

    labelEnter.transition()
        .duration(800)
        .attr("x", d => d.x)
        .attr("y", d => d.y+6)
        .style("opacity", 1);

    svg_bubbles.selectAll(".chart-title").raise();
    svg_bubbles.selectAll(".chart-subtitle").raise();
}

function formatSchoolsForDisplay(schoolArr) {
    let data = [];
    // console.log(schoolArr);
    if (schoolArr !== undefined && schoolArr.length > 0) {

        data = schoolArr.map(d => {
            let displayItem = {};
            displayItem.text = d.Name;
            displayItem.isRed = !CanApply(d);
            displayItem.raw = d;
            return displayItem;
        });
        // console.log(data);

        bubble_chart_title.text("Medical Schools in " + schoolArr[0]["Province/State"]);
        document.getElementById("school-vis").style.display = "block";
    } else {
        document.getElementById("school-vis").style.display = "none";
        selected_item = null;
        console.log("hidden");
    }

    if (selected_item) {
        updateSchoolInfo(selected_item.raw);
    } else {
        document.getElementById("school-info").style.display = "none";
    }
    updateChart(data);
}

function updateSchoolInfo(schoolData) {
    document.getElementById("school-info").style.display = "block";
    let hasResidenceRequirement = MeetsResidenceRequirement(schoolData);
    let meetsMCAT = MeetsMCATRequirement(schoolData);
    let meetsGPA = MeetsGPARequirement(schoolData);
    let meetsCASPER = MeetsCasperRequirement(schoolData);


    let sectionScores = schoolData["MCAT Minimum"].split("/");
    sectionScores = sectionScores.map(score => parseInt(score));

    let gpa = parseFloat(schoolData["GPA Minimum"]);
    let residency = schoolData["Residence Requirements"].includes("Citizen");
    let casper = !schoolData["Requires CASPER"].includes("Yes");

    // console.log(schoolData);
    // console.log(sectionScores);
    // console.log(residency);
    // console.log(meetsCASPER);
    // console.log(casper);

    let canApply = document.getElementById("canApply");
    if (CanApply(schoolData)) {
        canApply.style.color = "deepskyblue";
        canApply.innerText = "Can Apply";
    } else {
        canApply.style.color = "red";
        canApply.innerText = "Cannot Apply";
    }

    let residencyElement = document.getElementById("residency");
    if (hasResidenceRequirement) {
        residencyElement.style.color = "deepskyblue";
    } else {
        residencyElement.style.color = "red";
    }

    if (residency) {
        residencyElement.innerHTML = "Citizen or Permanent Resident";
    } else {
        residencyElement.innerHTML = "No residency requirements";
    }

    let sectionReq = document.getElementById("sectionRequirements");
    sectionReq.style.display = "none";
    let mcatElement = document.getElementById("mcat");
    if (meetsMCAT) {
        mcatElement.style.color = "deepskyblue";
    } else {
        mcatElement.style.color = "red";
    }

    if (sectionScores.length === 0 || (isNaN(sectionScores[0]) && sectionScores.length === 1)) {
        mcatElement.innerText = "No MCAT Requirements";
    } else if (sectionScores.length === 1) {
        mcatElement.innerText = `Section Total must be at least ${sectionScores[0]}`;
    } else {
        mcatElement.innerText = `Requirements for individual sections`;
        sectionReq.style.display = "block";


        let mcat0 = parseInt(document.getElementById("Chem/Phys").value);
        let mcat1 = parseInt(document.getElementById("Bio/Biochem").value);
        let mcat2 = parseInt(document.getElementById("Psych/Soc").value);
        let mcat3 = parseInt(document.getElementById("CARS").value);
        let userSectionScores = [mcat0, mcat1, mcat2, mcat3];

        for (let i = 0; i < 4; i++) {
            let specificSection = document.getElementById(`sectionRequirements${i}`);
            specificSection.innerText = `${sectionScores[i]}`

            if (isNaN(sectionScores[i])) {
                specificSection.style.color = "deepskyblue";
                specificSection.innerText = "No minimum score for section";
            } else if (userSectionScores[i] >= sectionScores[i]) {
                specificSection.style.color = "deepskyblue";
            } else {
                specificSection.style.color = "red";
            }
        }
    }


    let gpaElement = document.getElementById("gpa");
    if (meetsGPA) {
        gpaElement.style.color = "deepskyblue";
    } else {
        gpaElement.style.color = "red";
    }

    if (gpa > 80) {
        gpa = 3.7;
    }
    gpaElement.innerText = `${gpa}`
    if (isNaN(gpa)) {
        gpaElement.innerText = "No GPA requirements";
    }


    let casperElement = document.getElementById("casper");
    if (meetsCASPER) {
        casperElement.style.color = "deepskyblue";
    } else {
        casperElement.style.color = "red";
    }
    casperElement.innerText = schoolData["Requires CASPER"];

    let schoolElement = document.getElementById("school-name");
    schoolElement.innerText = schoolData["Name"];

}