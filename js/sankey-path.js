function SankeyPath(containerId) {
    var margin = { left: 0, right: 150, top: 15, bottom: 15 };
    var width  = 500 - margin.left - margin.right;
    var height = 300 - margin.top  - margin.bottom;

    var fillAccessor = function(d) { return d.color || "000"};
    var svg, sankey, path, linksG, nodesG;

    var chart = function(selection) {
        selection.each(function(data, index) {

            svg = d3.select(containerId).append("svg")
                .attr("width",  width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            sankey = d3.sankey()
                .nodeWidth(35)
                .nodePadding(10)
                .size([width, height]);

            path = sankey.link();

            chart.update(data);
        });
    }

    chart.update = function(data) {
        sankey
            .nodes(data.nodes)
            .links(data.links)
            .layout(32);

        linksG = svg.append("g");
        links  = linksG.selectAll(".link").data(data.links);

        links.exit().remove();

        links.enter().append("path")
            .attr("class", "link");
            // @TODO title

        links.attr("d", path)
          .style("stroke-width", function(d) { return Math.max(1, d.dy); })
          .sort(function(a, b) { return b.dy - a.dy; });

        nodesG = svg.append("g");
        nodes  = nodesG.selectAll(".node")
            .data(data.nodes);

        nodes.exit().remove();

        nodes.enter().append("g")
            .attr("class", function(d) { return "node " + (d.className || ""); })
          .append("rect")
            .attr("height", function(d) { return d.dy; })
            .attr("width", sankey.nodeWidth())
            .style("fill", fillAccessor)
            .style("stroke", "none")

        nodes.append("text")
            .attr("x", -6)
            .attr("y", function(d) { return d.dy / 2; })
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .attr("transform", null)
            .text(function(d) { return d.name; })
            // .filter(function(d) { return d.x < width / 2; })
            .attr("x", 6 + sankey.nodeWidth())
            .attr("text-anchor", "start");

        nodes.attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
            .call(
                d3.behavior.drag()
                    .origin(function(d) { return d; })
                    .on("dragstart", function() {
                        this.parentNode.appendChild(this); /* brings node to front */ })
                    .on("drag", dragNode)
            );

        function dragNode(d) {
            d3.select(this).attr("transform",
                // drag only in y direction
                "translate(" + d.x + "," + (
                d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))
            ) + ")");

            sankey.relayout();
            links.attr("d", path);
        }
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