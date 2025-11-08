const svg = d3.select("#map");
const width = parseInt(svg.style("width"));
const height = parseInt(svg.style("height"));



class CanadaMapVisualization {
    constructor(container, data, geojson) {
        this._parentElement = container;
        this._displayData = data;
        this._geojson = geojson;
        this._selected_province = null;
        this.click_callback = null;
    }

    initVis() {
        let vis = this;

        // load both geojson and values, then draw
        Promise.all([vis._geojson, vis._displayData])
            .then(([geojson, values]) => {
                this.drawChoropleth(geojson, values);
            })
            .catch(err => {
                console.error("Error loading data:", err);
                svg.append("text")
                    .attr("x", 20)
                    .attr("y", 40)
                    .attr("fill", "red")
                    .text("Failed to load data. Check console for details.");
            });
    }

    updateVisPublic() {
        let vis = this;
        Promise.all([vis._geojson, vis._displayData])
            .then(([geojson, values]) => {
                this.updateVis(geojson);
            });
    }

    countCanApply(arr) {
        let count = 0;
        arr.forEach(d => {
            if (CanApply(d)) {
                count++;
            }
        })
        return count;
    }

    drawChoropleth(geojson, values) {
        let vis = this;

        // Color scale: sequential from light -> dark.
        const color = d3.scaleSequential([0, 100], d3.interpolateHsl("#F98B87", "deepskyblue"));

        // Projection: let D3 compute a projection to fit the geojson in the SVG
        const projection = d3.geoMercator()
            .fitSize([width, height], geojson);

        vis.path = d3.geoPath().projection(projection);

        // Create a transformable group for map features (this group will be zoomed/panned)
        const mapG = svg.append("g").attr("class", "map-group");

        // Draw provinces inside mapG
        vis.provincesG = mapG.append("g")
            .attr("class", "provinces");

        this.updateVis(geojson);

        this.createLegend(0, 100, color);

        // Create SVG tooltip (a <g> with rect + text) and helper functions
        // IMPORTANT: svgTooltip is appended AFTER the map group so it is not transformed by zoom
        vis.svgTooltip = svg.append("g")
            .attr("class", "svg-tooltip")
            .style("display", "none")
            .style("pointer-events", "none"); // don't capture mouse events

        // rect: explicitly set fill/stroke so it won't default to black
        vis.svgTooltip.append("rect")
            .attr("rx", 6)
            .attr("ry", 6)
            .attr("class", "svg-tooltip-bg")
            .attr("fill", "white")
            .attr("stroke", "#bbb")
            .attr("opacity", 0.98);

        vis.tooltipText = vis.svgTooltip.append("text")
            .attr("class", "svg-tooltip-text")
            .attr("x", 0)
            .attr("y", 0)
            .attr("font-size", 13)
            .attr("fill", "#111")
            .attr("text-anchor", "start")
            .attr("dominant-baseline", "hanging"); // measure from the top

        // ZOOM: set up d3.zoom and attach to svg. It transforms mapG only.
        const minZoom = 1;
        const maxZoom = 8;
        const zoom = d3.zoom()
            .scaleExtent([minZoom, maxZoom]) // min/max zoom
            .translateExtent([[-200, -200], [width + 200, height + 200]]) // limit panning
            .on("zoom", (event) => {
                mapG.attr("transform", event.transform);
            });

        svg.call(zoom); // enable wheel & pinch zoom + drag pan

        // Control helpers
        function zoomBy(scaleFactor) {
            svg.transition()
                .duration(350)
                .call(zoom.scaleBy, scaleFactor);
        }
        function resetZoom() {
            svg.transition()
                .duration(450)
                .call(zoom.transform, d3.zoomIdentity);
        }

        // Wire up the UI controls (buttons)
        d3.select("#zoom-in").on("click", () => zoomBy(1.5));
        d3.select("#zoom-out").on("click", () => zoomBy(1 / 1.5));
        d3.select("#reset").on("click", resetZoom);
    }

    showSvgTooltip(x, y, lines) {
        let vis = this;
        // Update text (use tspans for multiple lines)
        const tspans = vis.tooltipText.selectAll("tspan")
            .data(lines, (d, i) => i);

        tspans.join(
            enter => enter.append("tspan")
                .attr("x", 0)
                .attr("dy", (d, i) => i === 0 ? "0em" : "1.2em")
                .text(d => d),
            update => update
                .attr("x", 0)
                .attr("dy", (d, i) => i === 0 ? "0em" : "1.2em")
                .text(d => d),
            exit => exit.remove()
        );

        // Make tooltip visible before measuring
        vis.svgTooltip.style("display", null)
            .attr("transform", `translate(${x},${y})`);

        // measure
        const padding = 6;
        const bbox = vis.tooltipText.node().getBBox();

        vis.svgTooltip.select("rect")
            .attr("x", -padding)
            .attr("y", -padding)
            .attr("width", bbox.width + padding * 2)
            .attr("height", bbox.height + padding * 2);
    }

    hideSvgTooltip() {
        let vis = this;
        vis.svgTooltip.style("display", "none");
    }

    provinceName(feature) {
        return feature.properties.NAME
            ?? feature.properties.name
            ?? feature.properties.province
            ?? feature.properties.prov_name
            ?? feature.properties.PROVNAME
            ?? "Unknown";
    }

    updateVis(geojson) {
        let vis = this;
        const color = d3.scaleSequential([0, 100], d3.interpolateHsl("#F98B87", "deepskyblue"));
        let counts = d3.rollup(
            vis._displayData,
            v => v,                      // Aggregation function to count occurrences
            d => d["Province/State"].toLowerCase()     // Group by the value itself
        );

        console.log("updating");

        if (vis._selected_province) {
            console.log("reached");
            formatSchoolsForDisplay(counts.get(vis._selected_province.toLowerCase()));
        } else {
            formatSchoolsForDisplay([]);
        }


        vis.provincesG.selectAll("path")
            .data(geojson.features)
            .join("path")
            .attr("d", vis.path)
            .attr("stroke", d => {
                if (vis.provinceName(d) !== vis._selected_province) {
                    return "#fff";
                } else {
                    return "orange";
                }
            })
            .attr("stroke-width", d => {
                if (vis.provinceName(d) !== vis._selected_province) {
                    return 0.8;
                } else {
                    return 4.0;
                }
            })
            .on("mousemove", (event, d) => {
                // Coordinates in SVG user space (not the transformed group's local coords)
                const [mx, my] = d3.pointer(event, svg.node());
                const name = this.provinceName(d);
                // const v = values[name];

                let item = counts.get(name.toLowerCase());
                let v = undefined;
                if (item !== undefined) {
                    v = Math.round((100.0 * this.countCanApply(item)) / item.length);
                }

                // Show and position SVG tooltip (12px offset)
                this.showSvgTooltip(mx + 12, my + 12, [
                    name,
                    (v === undefined ? "No Medical Schools in Province" : `${v}% of schools will accept `),
                    (v === undefined ? "" : "your application")
                ]);
            })
            .on("mouseleave", () => this.hideSvgTooltip())
            .on("click", (event, d) => {
                if (vis._selected_province === vis.provinceName(d)) {
                    vis._selected_province = null;
                } else {
                    vis._selected_province = vis.provinceName(d);
                }
                // vis.updateVis(geojson);
                if (vis.click_callback !== null && vis._selected_province !== null) {
                    vis.click_callback(counts.get(vis.provinceName(d).toLowerCase()));
                } else if (vis.click_callback !== null) {
                    vis.click_callback([]);
                }
                document.getElementById("school-vis").scrollIntoView({ behavior: 'smooth' });
            })
            .transition()
            .duration(1000)
            .attr("fill", d => {
                const name = this.provinceName(d);

                let item = counts.get(name.toLowerCase());
                if (item === undefined) { return "#efefef"; }

                let v = Math.round((100.0 * this.countCanApply(item)) / item.length);
                return (v == null || isNaN(v)) ? "#efefef" : color(v);
            });
    }

    createLegend(min, max, colorScale) {
        const legendContainer = d3.select("#legend");
        legendContainer.selectAll("*").remove();

        if (min == null || max == null) {
            legendContainer.append("div").text("No numeric data to draw the legend.");
            return;
        }

        // Create 5 buckets
        const steps = 5;
        const thresholds = d3.range(0, steps).map(i => min + (i / (steps - 1)) * (max - min));

        thresholds.forEach((t, i) => {
            const next = thresholds[i + 1];
            const label = (i < thresholds.length - 1)
                ? `${Math.round(t)}% – ${Math.round(next)}%`
                : `${Math.round(t)}%`;
            const swatch = legendContainer.append("div").attr("class", "legend-item");
            swatch.append("div")
                .attr("class", "legend-swatch")
                .style("background", colorScale(t));
            swatch.append("div").text(label);
        });
    }
}