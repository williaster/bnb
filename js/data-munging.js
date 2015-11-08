// requires d3 + crossfilter libs
var mungeData = function(data) {
    var monthDayYear = d3.time.format("%m/%d/%y").parse;

    var listings = {};
    var cf   = listings.crossfilter = crossfilter(data);
    var dims = listings.dims = {
        dateCreated:     cf.dimension(function(d) { return monthDayYear(d.date_created); }),
        location:        cf.dimension(function(d) { return [+d.approx_longitude, +d.approx_latitude]; }),
        bedrooms:        cf.dimension(function(d) { return +d.bedrooms; }),
        bathrooms:       cf.dimension(function(d) { return +d.bathrooms; }),
        capacity:        cf.dimension(function(d) { return +d.person_capacity; }),
        instantBookable: cf.dimension(function(d) { return +d.instant_bookable; })
    };

    var groups = listings.groups = {

    };

    listings.metrics = {
        newListingsPerDay: dims.dateCreated.group().reduceCount(),
        newListingsPerLocation: dims.location.group().reduceCount()
    };

    return listings;
};