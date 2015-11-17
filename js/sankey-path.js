function SankeyPath(containerId) {
    var margin = { left: 0, right: 150, top: 15, bottom: 15 };
    var width  = 500 - margin.left - margin.right;
    var height = 300 - margin.top  - margin.bottom;

    var commaFormat  = d3.format(",");
    var fillAccessor; // = function(d) { return d.color || "000"};
    var svg, sankey, path, linksG, nodesG, nodeRects, nodeText, tooltip;

    var chart = function(selection) {
        selection.each(function(data, index) {

            svg = d3.select(containerId).append("svg")
                .attr("width",  width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            sankey = d3.sankey()
                .nodeWidth(25)
                .nodePadding(15)
                .size([width, height]);

            path = sankey.link();

            tooltip = d3.select(containerId)
              .append("div")
                .attr("class", "sankey-tooltip")
                .style("opacity", 0);

            chart.update(data);
        });
    }

    chart.update = function(data) {
        sankey
            .nodes(data.nodes)
            .links(data.links)
            .layout(50);

        if (!linksG) {
            linksG = svg.append("g");
        }
        links = linksG.selectAll(".link")
            .data(data.links, function(d) {
                return d.source.name + d.target.name;
            });

        links.exit().remove();

        links.enter().append("path")
            .attr("class", "link")
            .on("mouseover", onmouseover)
            .on("mouseout",  onmouseout);

        links.attr("d", path)
          .transition().duration(200)
            .style("stroke-width", function(d) { return Math.max(1, d.dy); })
            .sort(function(a, b) { return b.dy - a.dy; });

        if (!nodesG) {
            nodesG = svg.append("g");
        }
        nodes = nodesG.selectAll(".node")
            .data(data.nodes);

        nodes.exit().remove();

        var temp = nodes.enter().append("g");

        temp.append("rect")
            .attr("width", sankey.nodeWidth())
            // .style("stroke", "none")
            .on("mouseover", onmouseover)
            .on("mouseout",  onmouseout);

        temp.append("text")
            .attr("x", -6)
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .attr("transform", null)
            .attr("x", 6 + sankey.nodeWidth())
            .attr("text-anchor", "start");

        nodes
            .attr("class", function(d) { return "node " + (d.className || ""); })
            .transition().duration(200)
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

        nodes.select("rect")
            // .style("fill", fillAccessor)
            .transition().duration(200)
            .attr("height", function(d) { return d.dy; });

        nodes.select("text")
            // .attr("class", "name")
            .attr("y", function(d) { return d.dy / 2; })
            .text(function(d) {
                return d.value ? d.name : ""
            })

        // nodes.select("text")
        //   .append("tspan")
        //     .attr("class", "value")
        //     .attr("y", function(d) { return d.dy / 2; })
        //     .text(function(d) {
        //         return d.value ? (d.value + " (" + d.percentage + ")") : ""
        //     });

            //     }
            //     var name = d.name;
            //     var n    = d.value + " (" + d.percentage + ")";
            //     return "<tspan class='name'>" + name + "</tspan>" +
            //            "<tspan class='value'>" + n + "</tspan>";
            // })
            // .attr("y", function(d) { return d.dy / 2; })

        nodes.call(
            d3.behavior.drag()
                .origin(function(d) { return d; })
                .on("dragstart", function() {
                    this.parentNode.appendChild(this); /* brings node to front */ })
                .on("drag", dragNode)
        );

        function dragNode(d) {
            // Only drag along y-axis
            var y = Math.max(0, Math.min(height - d.dy, d3.event.y));
            d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = y) + ")");

            sankey.relayout();
            links.attr("d", path);
        };
        function onmouseover(d) {
            tooltip
                .html(function() { return getTooltipHtml(d); })
              .transition()
                .delay(300)
                .duration(200)
                .style("left", (d3.event.pageX + 10)  + "px")
                .style("top",  (d3.event.pageY + 10) + "px")
                .style("opacity", 0.95);

        };
        function onmouseout(d) {
            tooltip.transition()
                .duration(100)
                .style("opacity", 0);
        };
        function getTooltipHtml(d) {
            var html = "";
            if (d.sourceLinks) { // is node
                return "Count: <span class='emph'>" + commaFormat(d.value); + "</span>";
            }
            else {
                var sumLinks = function(links) {
                    return d3.sum(links.map(function(l) { return l.value; }));
                }
                var val     = commaFormat(d.value);
                var sourcePercent = d3.round((d.value / d.source.value) * 100, 1);
                var targetPercent = d3.round((d.value / d.target.value) * 100, 1);
            // var n    = d.value + " (" + d.percent + "%)";

            // return val + " " + sourcePercent + " " + targetPercent;
            return "<div class=''>Count: <span class='emph'>" + val + "</span></div>" +
                   "<div class='percents'>" +
                        "<span class='emph'>" + (isFinite(sourcePercent) ? sourcePercent : "100") + "%</span> of source<br/>" +
                        "<span class='emph'>" + (isFinite(targetPercent) ? targetPercent : "--") + "%</span> of target" +
                   "</div>";
            }
        };
    }

    // getter / setters
    chart.width = function(_) {
        if (typeof _ === "undefined") return width;
        width = _;
        return chart;
    };
    chart.height = function(_) {
        if (typeof _ === "undefined") return height;
        height = _;
        return chart;
    };
    chart.fill = function(_) {
        if (typeof _ === "undefined") return fillAccessor;
        fillAccessor = _;
        return chart;
    };

    return chart;
};