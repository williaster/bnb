// requires d3 + crossfilter libs
var mungeData = function(data) {
    var monthDayYear = d3.time.format("%m/%d/%y").parse;
    console.log(data[0])
    data.sort(function(a,b) { return a.date_created - a.date_created; })

    var listings = {};
    var cf   = listings.crossfilter = crossfilter(data);
    var dims = listings.dims = {
        dateCreated:     cf.dimension(function(d) { return monthDayYear(d.date_created); }),
        location:        cf.dimension(function(d) { return [+d.approx_longitude, +d.approx_latitude]; }),
        // bedrooms:        cf.dimension(function(d) { return +d.bedrooms; }),
        // bathrooms:       cf.dimension(function(d) { return +d.bathrooms; }),
        capacity:        cf.dimension(function(d) { return +d.person_capacity; }),
        instantBookable: cf.dimension(function(d) { return +d.instant_bookable ? "Yes" : "No"; }),
        type:            cf.dimension(function(d) { return d.listing_type; })
    };

    var groups = listings.groups = {
        dateCreated: dims.dateCreated.group(),
        location:    dims.location.group(),
        capacity:    dims.capacity.group(),
        type:        dims.type.group(),
        instantBookable: dims.instantBookable.group()
    };

    listings.metrics = {
        newListingsPerDay: function() {
            return groups.dateCreated.reduceCount();
        },
        newListingsPerLocation: function() {
            return groups.location.reduceCount();
        }
    };

    return listings;
};