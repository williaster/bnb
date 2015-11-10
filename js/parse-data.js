// requires d3 + crossfilter libs

// For parsing dates with diff formats
var monthDayYear = d3.time.format("%m/%d/%y").parse;
var yearMonthDay = d3.time.format("%Y-%m-%d").parse;
var yearMonthDayHourMinuteSecond = d3.time.format("%Y-%m-%d %H:%M:%S.%L").parse;
var hourInMs = 1000 * 60 * 60;
var dayInMs  = hourInMs * 24;

function mungeData(listingsData, interactionsData) {
    var listings     = _parseListings(listingsData);
    var interactions = _parseInteractions(interactionsData);

    return $d = { listings, interactions};
};

function _parseListings(rawData) {
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

function _parseInteractions(rawData, instantlyBookableIds) {
    rawData = rawData.filter(function(d) { return d.first_interaction_time_utc; });
    console.log("interactions", rawData[0])

    var interactions = {};

    var cf = interactions.crossfilter = crossfilter(rawData);

    var dims = interactions.dims = {
        checkinDate: cf.dimension(function(d) {
            return yearMonthDay(d.checkin_date);
        }),
        firstInteraction: cf.dimension(function(d) {
            return d3.time.day(
                yearMonthDayHourMinuteSecond(d.first_interaction_time_utc)
            );
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
        }),
        timeToReply: cf.dimension(function(d) {
            var firstInteraction = yearMonthDayHourMinuteSecond(d.first_interaction_time_utc);
            var firstReply       = yearMonthDayHourMinuteSecond(d.first_reply_time_utc);

            if (firstInteraction !== null &&
                firstReply !== null) {
                var nearestHour = Math.round((firstReply - firstInteraction) / hourInMs) * hourInMs;
                var nHours = nearestHour / 3600000;

                return nHours + "-" + (nHours + 1) + " hrs";
            }
            else {
                return "NA";
            }
        }),
        // didReply: cf.dimension(function(d) {}),
        // successfulRequest: cf.dimension(function(d) {

        // })
        // success: cf.dimension(function(d) {
        //     return
        // })
        // replied:   cf.dimension(function(d) { return d. } )
    };

    var groups = interactions.groups = {
        checkinDate: dims.checkinDate.group(),
        firstInteraction: dims.firstInteraction.group(),
        nights: dims.nights.group(),
        guests: dims.guests.group(),
        originCountry: dims.originCountry.group(),
        timeToReply: dims.timeToReply.group()
        // success: dims.success.group().reduce(reduceAddAvg, reduceRemoveAvg, reduceInitAvg, "")
    };

    return interactions;
}


function reduceAddAvg(p,v,attr) {
  ++p.count
  p.sum += +v[attr];
  p.avg = p.sum / p.count;
  return p;
}
function reduceRemoveAvg(p,v,attr) {
  --p.count
  p.sum -= +v[attr];
  p.avg = p.sum / p.count;
  return p;
}
function reduceInitAvg() {
  return { count: 0, sum: 0, avg: 0 };
}
// var statesAvgGroup = statesAvgDimension.group().reduce(reduceAddAvg, reduceRemoveAvg, reduceInitAvg, 'savings');
// var statesAvgGroup = statesAvgDimension.group().reduce(reduceAddAvg, reduceRemoveAvg, reduceInitAvg, 'cost');
