
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

        // Add X Axis Label
        vis.svg.append("text")
            .attr("class", "x label")
            .attr("text-anchor", "middle")
            .attr("x", vis.width / 2)
            .attr("y", vis.height + vis.margin.bottom - 5)
            .text("Eligibility");

        // Add Y Axis Label
        vis.svg.append("text")
            .attr("class", "y label")
            .attr("text-anchor", "middle")
            .attr("x", -vis.height / 2)
            .attr("y", -vis.margin.left + 15)
            .attr("transform", "rotate(-90)")
            .text("Number of Schools");
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
            .attr("fill", d => {
                if (x_data[d[0]] === x_data[0]) {
                    return "skyblue";
                } else {
                    return "red";
                }
            })
            .transition()
            .duration(1000)
            .attr("x", d => {
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

        // this.updateEligibility(counts);
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