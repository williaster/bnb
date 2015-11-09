// requires d3 + crossfilter libs
var monthDayYear = d3.time.format("%m/%d/%y").parse;
var yearMonthDay = d3.time.format("%Y-%m-%d").parse;
var yearMonthDayHourMinuteSecond = d3.time.format("%Y-%m-%d %H:%M:%S.%L").parse;

var parseListings = function(rawData) {
    console.log("listings", rawData[0])
    var listings = {};

    var cf = listings.crossfilter = crossfilter(rawData);

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

    return listings;
}

var parseInteractions = function(rawData) {
    rawData = rawData.filter(function(d) { return d.first_interaction_time_utc; });
    console.log("raw interactions", rawData.length);

    var interactions = {};

    var cf = interactions.crossfilter = crossfilter(rawData);

    var dims = interactions.dims = {
        checkinDate: cf.dimension(function(d) {
            return yearMonthDay(d.checkin_date);
        }),
        firstInteraction: cf.dimension(function(d) {
            return yearMonthDayHourMinuteSecond(d.first_interaction_time_utc);
        }),
        nights: cf.dimension(function(d) {
            return +d.nights;
        }),
        guests: cf.dimension(function(d) {
            var num = +d.guests;
            return isNaN(num) ? 1 : num;
        }),
        originCountry: cf.dimension(function(d) {
            return d.guest_origin_country;
        })
        // replied:   cf.dimension(function(d) { return d. } )
    };

    var groups = interactions.groups = {
        checkinDate: dims.checkinDate.group(),
        firstInteraction: dims.firstInteraction.group(),
        nights: dims.nights.group(),
        guests: dims.guests.group(),
        originCountry: dims.originCountry.group()
    };

    return interactions;
}

var mungeData = function(listingsData, interactionsData) {
    var listings     = parseListings(listingsData);
    var interactions = parseInteractions(interactionsData);

    return { listings, interactions};
};
