var MapChart = function(containerId) {
    // Lots of private variables
    var width  = 400
    var height = 400

    // more vars for caller
    var mapData;
    var colorAccessor;
    var radiusAccessor;
    var dataKeyAccessor  = function(d, i) { return i; }; // uniquely ids data
    var latitudeAccessor = function(d) { return +d.latitude; };
    var longitudeAccessor= function(d) { return +d.longitude; };
    var userAddedLabels  = [];
    var constantRadius   = false;
    var showLegend       = false;
    var mapScale         = 45000;
    var mapCenter        = [-119.9769, 38.94]; // tahoe

    // Color related
    var labelCircleRadius  = 2;
    var labelCircleColor   = "#000"
    var defaultCircleColor = "red";
    var circleOpacity      = 0.4;
    var colorScale = d3.scale.linear()
        .range(["#ef8a62","67a9cf"]);

    // Size related
    var defaultRadius = 3;
    var radiusScale = d3.scale.sqrt()
        .range([2, 15]);

    // Map projection
    var projection = d3.geo.mercator();
    var pathGenerator = d3.geo.path()
        .projection(projection);

    // Map zoom
    var zoom = d3.behavior.zoom()
        .on("zoom", function() {
            var translate = d3.event.translate.join(",");
            var scale = d3.event.scale;
            mapG.attr("transform", "translate(" + translate + ")scale(" + scale + ")");

            // @todo scale labels

            if (constantRadius) {
                 mapG.selectAll("circle.data")
                    .attr("r", function(d) {
                        var unscaled = radiusAccessor ? radiusScale(radiusAccessor(d)) : defaultRadius;
                        return unscaled / zoom.scale();
                    });
            }
        });

    var mapG, labelsG, dataG;

    var map = function(selection) {
        selection.each(function(data, index) {
            if (!mapData) return;

            projection.scale(mapScale).center(mapCenter);

            var mapSvg = d3.select(containerId).append("svg")
                .attr("class", "map-container")
                .attr("width", width)
                .attr("height", height);

            mapG = mapSvg.append("g");
            dataG = mapG.append("g");

            mapG.append("path")
              .datum(mapData)
                .attr("class", "map")
                .attr("d", pathGenerator);

            mapSvg.call(zoom); // make zoomable

            // Labels
            if (userAddedLabels.length) {
                labelsG = mapG.append("g");

                var labels = labelsG.selectAll("g.label")
                    .data(userAddedLabels)
                  .enter().append("g")
                    .attr("class", "label")
                    .attr("transform", function(d) {
                        return "translate(" + projection([+d.longitude, +d.latitude])[0] + "," + projection([+d.longitude, +d.latitude])[1] + ")";
                    })
                    // .attr("cx", function(d) {
                    //     return projection([+d.longitude, +d.latitude])[0];
                    // })
                    // .attr("cy", function(d) {
                    //     return projection([+d.longitude, +d.latitude])[1];
                    // });;

                labels.append("circle")
                    .attr("fill", labelCircleColor)
                    .attr("r", labelCircleRadius);

                labels.append("text")
                    .text(function(d) { return d.label; })
                    .attr("dx", 7)
                    .attr("dy", 2)
                    .attr("text-anchor", "left");

            }
            map.updateChart(data);
        });
    };

    map.updateChart = function(nextData) {
        // update domains if accessors passed  @TODO legend
        if (radiusAccessor) radiusScale.domain(d3.extent(radiusAccessor));
        if (colorAccessor)  colorScale.domain(d3.extent(colorAccessor));

        var dataCircles = dataG.selectAll("circle.data")
            .data(nextData, dataKeyAccessor);

        dataCircles // update existing points
            .attr("fill", function(d) {
                return colorAccessor ? colorScale(colorAccessor(d)) : defaultCircleColor;
            })
            .attr("r", function(d) {
                var unscaled = radiusAccessor ? radiusScale(radiusAccessor(d)) : defaultRadius;
                return constantRadius ? (unscaled / zoom.scale()) : unscaled;
            });

        dataCircles.enter().append("circle") // new entering points
            .attr("class", "data")
            .attr("fill", function(d) {
                return colorAccessor ? colorScale(colorAccessor(d)) : defaultCircleColor;
            })
            .attr("opacity", circleOpacity)
            .attr("r",  0)
            .attr("cx", function(d) {
                return projection([+d.longitude, +d.latitude])[0];
            })
            .attr("cy", function(d) {
                return projection([+d.longitude, +d.latitude])[1];
            })
          .transition()
            .duration(500)
            .attr("r",  function(d) {
                var unscaled = radiusAccessor ? radiusScale(radiusAccessor(d)) : defaultRadius;
                return constantRadius ? (unscaled / zoom.scale()) : unscaled;
            });

        dataCircles.exit() // exiting points
          .transition()
            .duration(500)
            .attr("r", 0).remove();
    };

    // Getter / setters depending on args, for caller to customize
    map.mapData = function(_) {
        if (typeof _ === "undefined") return mapData;
        mapData = _;
        return map;
    };
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
    map.labels = function(_) {
        userAddedLabels = _;
        return map;
        // [ { label: string, long: number, lat: number } ]
    };
    map.updatePoints = function(nextData) {
        this.updateChart(nextData);
    };

    return map;
}
