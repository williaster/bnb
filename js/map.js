var MapChart = function(containerId) {
    // Lots of private variables
    var width  = 400;
    var height = 400;

    // more vars for caller
    var mapData;
    var colorAccessor;
    var radiusAccessor;
    var dataKeyAccessor  = function(d, i) { return i; }; // uniquely ids data
    var locationAccessor = function(d) { return d.value; }
    var userAddedLabels  = [];
    var constantRadius   = false;
    var showLegend       = true;
    var mapScale         = 160000;
    var mapCenter        = [-120.12, 39.08]; // tahoe

    // Color related
    var defaultCircleColor = "#0571b0"; //"#4dac26"; //"#d01c8b";
    var colorScale = d3.scale.linear()
        .range(["#0571b0","#ca0020"]);

    // Size related
    var defaultRadius = 4;
    var radiusScale = d3.scale.sqrt()
        .range([0, 15]);

    // Map tiles
    var tile = d3.geo.tile();
    var tileProjection = d3.geo.mercator();
    var tilePath = d3.geo.path()
        .projection(tileProjection);

    // Data projection
    var dataProjection = d3.geo.mercator();

    // Map zoom
    var zoom = d3.behavior.zoom()
        .on("zoom", onZoom);

    var mapSvg, dataG, tilesG, legend, tooltip;

    var map = function(selection) {
        selection.each(function(data, index) {
            tile.size([width, height]);

            // Data projection
            dataProjection
                .scale((mapScale) / 2 / Math.PI)
                .translate([-width / 2, -height / 2]);

            // Map zoom
            zoom.scale(dataProjection.scale() * 2 * Math.PI)
                .scaleExtent([1 << 12, 1 << 20])
                .translate(dataProjection(mapCenter).map(function(x) { return -x; }))

            mapSvg = d3.select(containerId).append("svg")
                .attr("class", "map")
                .attr("width", width)
                .attr("height", height)
                .call(zoom); // make zoomable

            tilesG = mapSvg.append("g")
                .attr("class", "tile-layer");

            dataG  = mapSvg.append("g")
                .attr("class", "data-layer");

            if (showLegend && radiusAccessor) {
                legend = getLegend(mapSvg, radiusScale);
            }

            tooltip = d3.select(containerId)
              .append("div")
                .attr("class", "map-tooltip")
                .style("opacity", 0);

            onZoom();
            map.updateChart(data);
        });
    };

    function tipMouseover(d) {
        d3.select(this).classed("data-hover", true);

        // var color = colorScale(d.CR);
        var long = -d.key[0];
        var lat  = +d.key[1];
        var html = "<span class='emph'>" + radiusAccessor(d) + "</span> new listings<br/>" +
                   "<span class='emph' style='color:" + colorScale(colorAccessor(d)) + ";'>" +
                        d3.round(colorAccessor(d), 1) +
                   "</span>% of total in area<br/>" +
                   "<span class='emph'>" + lat + "&deg; </span>N <span class='emph'>" + long + "&deg; </span>W";

        tooltip.html(html)
            .style("left", (d3.event.pageX + 5) + "px")
            .style("top", (d3.event.pageY + 10) + "px")
          .transition()
            .delay(300)
            .duration(200)
            .style("opacity", 0.95);
    };

    // tooltip mouseout event handler
    function tipMouseout(d) {
        d3.select(this).classed("data-hover", false);

        tooltip.transition()
            .duration(200)
            .style("opacity", 0);
    };


    function getLegend(svg, scale) {

        var _legend = d3.legend.color()
            .shapeWidth(30)
            .shapePadding(30)
            .orient('horizontal')
            .labelOffset(15)
            .labelAlign("middle")
            .title("Fraction of total in area")
            .scale(colorScale);

         legend = d3.select(containerId)
           .append("div")
           .append("svg")
            .attr("height", "100px")
            .attr("width", width + "px")
          .append("g")
            .attr("class", "legend")
            .attr("transform", "translate(" + (width/3) + "," +  15 + ")")
          .call(_legend);

        return legend;
    }

    map.updateChart = function(nextData) {
        // update domains if accessors passed
        if (colorAccessor)  {
            colorScale.domain([0,100]); //d3.extent(nextData, colorAccessor));
        }

        if (radiusAccessor) {
            radiusScale.domain([
                0,
                Math.max(2, d3.max(nextData, radiusAccessor))
            ]);
        }
        // if (showLegend) {
        //     legend.update();
        // }

        var dataCircles = dataG.selectAll("circle.data")
            .data(nextData, dataKeyAccessor);

        dataCircles.enter().append("circle") // new entering points
            .attr("class", "data")
            .attr("r",  0)
            .attr("cx", function(d) {
                return dataProjection(locationAccessor(d))[0];
            })
            .attr("cy", function(d) {
                return dataProjection(locationAccessor(d))[1];
            });

        dataCircles // update existing points
            .on("mouseover", tipMouseover)
            .on("mouseout", tipMouseout)
          .transition()
            .duration(500)
            .attr("fill", function(d) {
                return colorAccessor ? colorScale(colorAccessor(d)) : defaultCircleColor;
            })
            .attr("r", function(d) {
                var unscaled = radiusAccessor ? radiusScale(radiusAccessor(d)) : defaultRadius;
                return constantRadius ? (unscaled / zoom.scale()) : unscaled;
            });

        dataCircles.exit() // exiting points
          .transition()
            .duration(500)
            .attr("r", 0).remove();
    };

    function onZoom() {
        var tileData = tile
            .scale(zoom.scale())
            .translate(zoom.translate())
            ();

        dataProjection
            .scale(zoom.scale() / 2 / Math.PI)
            .translate(zoom.translate());

        dataG.selectAll("circle.data")
            .attr("cx", function(d) {
                return dataProjection(locationAccessor(d))[0];
            })
            .attr("cy", function(d) {
                return dataProjection(locationAccessor(d))[1];
            })

        var image = tilesG
            .attr("transform", "scale(" + tileData.scale + ")translate(" + tileData.translate + ")")
          .selectAll("image")
            .data(tileData, function(d) { return d; });

        image.exit()
            .remove();

        image.enter().append("image")
            .attr("xlink:href", function(d) {
                return "http://" + ["a", "b", "c"][Math.random() * 3 | 0] +
                       ".tile.stamen.com/toner/" + d[2] + "/" + d[0] + "/" + d[1] + ".png";
            })
            .attr("width", 1)
            .attr("height", 1)
            .attr("x", function(d) { return d[0]; })
            .attr("y", function(d) { return d[1]; });
    };

    // Getter / setters depending on args, for caller to customize
    map.key = function(_) {
        if (typeof _ === "undefined") return dataKeyAccessor;
        dataKeyAccessor = _;
        return map;
    }
    // long, lat
    map.width = function(_) {
        if (typeof _ === "undefined") return width;
        width = _;
        return map;
    };
    map.height = function(_) {
        if (typeof _ === "undefined") return height;
        height = _;
        return map;
    };
    map.scale = function(_) {
        if (typeof _ === "undefined") return scale;
        scale = _;
        return map;
    }
    map.center = function(_) {
        if (typeof _ === "undefined") return center;
        center = _;
        return map;
    };
    map.updatePoints = function(nextData) {
        this.updateChart(nextData);
    };
    map.location = function(_) {
        if (typeof _ === "undefined") return locationAccessor;
        locationAccessor = _;
        return map;
    };
    map.radius = function(_) {
        if (typeof _ === "undefined") return radiusAccessor;
        radiusAccessor = _;
        return map;
    };
    map.color = function(_) {
        if (typeof _ === "undefined") return colorAccessor;
        colorAccessor = _;
        return map;
    };

    return map;
}
