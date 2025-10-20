function MeetsMCATRequirement(d) {
    let rawScore = parseInt(d["MCAT Minimum"], 10);
    rawScore = d["MCAT Minimum"].includes("/") ? NaN : rawScore;

    let mcat0 = parseInt(document.getElementById("Chem/Phys").value);
    let mcat1 = parseInt(document.getElementById("Bio/Biochem").value);
    let mcat2 = parseInt(document.getElementById("Psych/Soc").value);
    let mcat3 = parseInt(document.getElementById("CARS").value);
    // console.log(mcat0 + mcat1 + mcat2 + mcat3);
    let totalScore = mcat0 + mcat1 + mcat2 + mcat3;
    let sectionScores = d["MCAT Minimum"].split("/");
    sectionScores = sectionScores.map(score => parseInt(score));

    // guard for 'NA' MCAT requirements
    if (isNaN(rawScore) && !d["MCAT Minimum"].includes("/")) {
        // console.log(d["Name"] + " first " + sectionScores + " " + [mcat0, mcat1, mcat2, mcat3]);
        return true;
    }
    // MCAT total score is in dataset
    else if (!isNaN(totalScore) && !isNaN(rawScore) && totalScore >= rawScore) {
        // console.log(rawScore);
        // console.log(d["Name"] + " second " + sectionScores + " " + [mcat0, mcat1, mcat2, mcat3]);
        return true;
    } else if (!d["MCAT Minimum"].includes("/")) {
        return false; // insufficient input to determine if student is eligible
    }

    let meetsReqForSection = (student, req) => isNaN(req) || (student >= req && !isNaN(student));

    return meetsReqForSection(mcat0, sectionScores[0]) &&
            meetsReqForSection(mcat1, sectionScores[1]) &&
            meetsReqForSection(mcat2, sectionScores[2]) &&
            meetsReqForSection(mcat3, sectionScores[3]);
}

function MeetsGPARequirement(d) {
    let req = parseFloat(d["GPA Minimum"]);
    let gpa = parseFloat(document.getElementById("gpa-slider").value);
    // console.log(gpa + " " + req + " " + d["Name"]);
    return isNaN(req) || (gpa >= req) || (req >= 85 && gpa >= 3.7); // ubc records in percentage
}

function MeetsResidenceRequirement(d) {
    let canadianCitizenInput = document.getElementById("canadian-citizen");
    return !d["Residence Requirements"].includes("Citizen") || canadianCitizenInput.checked;
}

function MeetsCasperRequirement(d) {
    let casperInput = document.getElementById("taken-casper");
    return !d["Requires CASPER"].includes("Yes") || casperInput.checked;
}

function CanApply(d) {
    let hasResidenceRequirement = MeetsResidenceRequirement(d);
    let meetsMCAT = MeetsMCATRequirement(d);
    let meetsGPA = MeetsGPARequirement(d);
    let meetsCASPER = MeetsCasperRequirement(d);

    return hasResidenceRequirement && meetsMCAT && meetsGPA && meetsCASPER;
}

function ApplicantCategory(d) {
    let hasResidenceRequirement = MeetsResidenceRequirement(d);
    let meetsMCAT = MeetsMCATRequirement(d);
    let meetsGPA = MeetsGPARequirement(d);
    let meetsCASPER = MeetsCasperRequirement(d);

    if (CanApply(d) === true) {
        return 0;
    } else if (!hasResidenceRequirement && meetsMCAT && meetsGPA && meetsCASPER) {
        return 4;
    } else if (!meetsMCAT && meetsGPA && meetsCASPER && hasResidenceRequirement) {
        return 3;
    } else if (!meetsGPA && meetsCASPER && meetsMCAT && hasResidenceRequirement) {
        return 2;
    } else if (!meetsCASPER && meetsMCAT && meetsGPA && hasResidenceRequirement) {
        return 1;
    } else { // inadmissible in multiple ways
        return 5;
    }
}

class BarChartVis {

    constructor(parentElement, data){
        this._parentElement = parentElement;
        this._displayData = data;
    }

    initVis() {
        let vis = this;

        vis.margin = {top: 10, right: 40, bottom: 30, left: 40};

        vis.width = document.getElementById(vis._parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
        vis.height = document.getElementById(vis._parentElement).getBoundingClientRect().height  - vis.margin.top - vis.margin.bottom;

        // SVG drawing area
        vis.svg = d3.select("#" + vis._parentElement).append("svg")
            .attr("width", vis.width + vis.margin.left + vis.margin.right)
            .attr("height", vis.height + vis.margin.top + vis.margin.bottom)
            .append("g")
            .attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

        // Scales and axes
        let x_data = [
            "Can Apply", "Missing CASPER", "GPA cutoff", "MCAT cutoff",
            "Missing Residency", "Multiple Ineligibilities"
        ];
        vis.x = d3.scaleBand()
            .range([0, vis.width])
            .domain(x_data)
            .paddingInner(0.1);

        // console.log(counts);
        // console.log(counts.get(false).length);
        // console.log(d3.max(counts.values(), d => d.length));

        vis.y = d3.scaleLinear()
            .range([vis.height, 0])
            .domain([0, vis._displayData.length]);

        vis.xAxis = d3.axisBottom()
            .scale(vis.x);

        vis.yAxis = d3.axisLeft()
            .scale(vis.y);

        // console.log(vis.width);
        // console.log(vis.x(x_data[0]));
        // console.log(vis.x(x_data[1]));
        vis.updateVis();

        // Append x-axis
        vis.svg.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", "translate(0," + vis.height + ")")
            .call(vis.xAxis);

        // append y-axis
        vis.svg.append("g")
            .attr("class", "y-axis axis")
            .call(vis.yAxis);
    }

    updateVis() {
        let vis = this;

        let x_data = [
            "Can Apply", "Missing CASPER", "GPA cutoff", "MCAT cutoff",
            "Missing Residency", "Multiple Ineligibilities"
        ];
        let counts = d3.rollup(
            vis._displayData,
            v => v,             // Aggregation function to count occurrences
            d => ApplicantCategory(d)    // Group by the value itself
        );
        // console.log(counts);

        let bars = vis.svg.selectAll("rect")
            .data(counts);

        bars.enter().append("rect")
            .merge(bars)
            .attr("width", vis.x.bandwidth())
            // .attr("fill", "skyblue")
            .transition()
            .duration(1000)
            .attr("x", d => {
                // console.log(d[0]);
                return vis.x(x_data[d[0]]);
            } )
            .attr("y", d => {
                // console.log(vis.y(d[1].length));
                return vis.y(d[1].length);
            } )
            .attr("height", d => {
                // console.log(vis.height);
                // console.log(vis.height - vis.y(d[1].length));
                return vis.height - vis.y(d[1].length);
            });

        // Exit
        bars.exit().remove();

        this.updateEligibility(counts);
    }

    updateEligibility(counts) {
        let schoolsLabel = document.getElementById('eligible-schools');
        if (!counts.get(0)) {
            schoolsLabel.innerText = "No Schools";
            return;
        }
        schoolsLabel.innerText = counts.get(0).map(d => d["Name"]).join(", ");
    }
}