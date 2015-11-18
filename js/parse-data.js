// requires d3 + crossfilter libs

// For parsing dates with diff formats
var monthDayYear = d3.time.format("%m/%d/%y").parse;
var yearMonthDay = d3.time.format("%Y-%m-%d").parse;
var yearMonthDayHourMinuteSecond = d3.time.format("%Y-%m-%d %H:%M:%S.%L").parse;
var hourInMs = 1000 * 60 * 60;
var halfDayInMs  = hourInMs * 12;
var dayInMs  = hourInMs * 24;
var timeFilter = [new Date("1/1/2013"), new Date("1/1/2015")];

function mungeData(listingsData, interactionsData) {
    listingsData = listingsData.filter(function(d) {
        var time =  monthDayYear(d.date_created);
        return time <= timeFilter[1] && time >= timeFilter[0];
    });
    interactionsData = interactionsData.filter(function(d) {
        if (!d.first_interaction_time_utc) return false;

        var time =  yearMonthDayHourMinuteSecond(d.first_interaction_time_utc);
        return time <= timeFilter[1] && time >= timeFilter[0];
    });

    var listings     = _parseListings(listingsData);
    var interactions = _parseInteractions(interactionsData);

    var instantlyBookable   = _getInstantlyBookableListingsLookup(listingsData);
    var dataForPathAnalysis = _parseDataForPathAnalysis(interactionsData, instantlyBookable);
    var filterPathAnalysisByDateRange = function(data, extent) {
        return _parseDataForPathAnalysis(interactionsData, instantlyBookable, extent);
    };

    return $d = {
        listingsRaw:     listingsData,
        interactionsRaw: interactionsData,
        listings: listings,
        interactions: interactions,
        paths: dataForPathAnalysis,
        filterPathAnalysisByDateRange,
        yearMonthDay,
        yearMonthDayHourMinuteSecond
    };
};

function _getInstantlyBookableListingsLookup(listingsData) {
    var ids = {};
    for (var i = 0, len = listingsData.length; i < len; i++) {
        if (+listingsData[i].instant_bookable) { // "0" or "1"
            ids[ listingsData[i].id_listing ] = true
        }
    }
    console.log("instantly bookable lookup", ids);
    return ids;
};

// extent is optional, will filter by date
function _parseDataForPathAnalysis(interactions, instantlyBookableLookup, extent) {
    function makeLinks(sourceToTargetToValues, valueKey) {
        var nInteractions = interactions.length;
        var contacted = 0, requested = 0, successful = 0, unsuccessful = 0;
        valueKey = valueKey || "count";

        var links = [];
        var currLink;
        for (var source in sourceToTargetToValues) {
            for (var target in sourceToTargetToValues[source]) {
                currLink = sourceToTargetToValues[source][target];

                links.push({
                    source:  +nameToIdLookup[source],
                    target:  +nameToIdLookup[target],
                    value:   currLink[valueKey],
                    percent: Math.round(currLink[valueKey] / nInteractions * 100 * 10) / 10
                });
                if (source === 'Guest contacted host') contacted+=currLink[valueKey];
                if (source === 'Guest requested booking') requested+=currLink[valueKey];
                if (target === 'Successful booking') successful+=currLink[valueKey];
                if (target === 'Un-successful booking') unsuccessful+=currLink[valueKey];
            }
        }
        console.log("contacted, requested, sum", contacted, requested, (contacted + requested));
        console.log("successful, unsuccessful, sum", successful, unsuccessful, (successful + unsuccessful));

        return links;
    };
    var idToNameLookup = {
        0: 'Guest contacted host',
        1: 'Guest requested booking',
        2: 'Host replied',
        3: 'Host did not reply',
        4: 'Host accepted booking request',
        5: 'Host rejected booking request',
        6: 'Guest updated booking',
        7: 'Successful booking',
        8: 'Un-successful booking',
        9: 'Booked instantly'
    };
    var nameToIdLookup = {}; // invert the above above
    for (var id in idToNameLookup) { nameToIdLookup[ idToNameLookup[id] ] = id; }

    var nodes = [
        { id: 0, name: idToNameLookup[0], className: 'guest' },
        { id: 1, name: idToNameLookup[1], className: 'guest' },
        { id: 2, name: idToNameLookup[2], className: 'host' },
        { id: 3, name: idToNameLookup[3], className: 'host' },
        { id: 4, name: idToNameLookup[4], className: 'host' },
        { id: 5, name: idToNameLookup[5], className: 'host' },
        { id: 6, name: idToNameLookup[6], className: 'guest' },
        { id: 7, name: idToNameLookup[7], className: 'good' },
        { id: 8, name: idToNameLookup[8], className: 'bad' },
        { id: 9, name: idToNameLookup[9], className: 'host' }
    ];

    var linksData = {};
    for (var name in nameToIdLookup) { linksData[name] = {} }

    var currInteraction,
        currLink,
        currDuration,
        // parsed times
        parsedFirstInteractionTime, parsedBookingRequestSubmittedTime,
        parsedHostRepliedTime, parsedHostAcceptedTime, parsedBookingTime,
        // variable names makes the code logic reasoning easier to understand
        isInstantlyBookable, wasBookedInstantly, hadFirstInteraction, guestRequestedBooking,
        firstInteractionWasBookingRequest, firstInteractionWasNotBookingRequest,
        hostNeverResponded, hostResponded, hostAccepted, hostRejected, guestRepliedAfterHostAccepted;

    var total = 0;
    for (var i = 0, len = interactions.length; i < len; i++) {
        currInteraction = interactions[i];

        parsedFirstInteractionTime        = yearMonthDayHourMinuteSecond(currInteraction.first_interaction_time_utc || "");
        parsedHostRepliedTime             = yearMonthDayHourMinuteSecond(currInteraction.first_reply_time_utc || "")
        parsedBookingRequestSubmittedTime = yearMonthDayHourMinuteSecond(currInteraction.booking_request_submitted_time_utc || "");
        parsedHostAcceptedTime            = yearMonthDayHourMinuteSecond(currInteraction.host_accepted_time_utc || "");
        parsedBookingTime                 = yearMonthDayHourMinuteSecond(currInteraction.booking_time_utc || "");

        if (extent) {
            if (!parsedFirstInteractionTime || parsedFirstInteractionTime < extent[0] || parsedFirstInteractionTime > extent[1]) {
                continue;
            }
        }
        total++;

        isInstantlyBookable                  = instantlyBookableLookup[currInteraction.id_listing];
        hadFirstInteraction                  = !!parsedFirstInteractionTime;
        guestRequestedBooking                = !!parsedBookingRequestSubmittedTime;
        firstInteractionWasBookingRequest    = hadFirstInteraction && currInteraction.first_interaction_time_utc === currInteraction.booking_request_submitted_time_utc;
        wasBookedInstantly                   = isInstantlyBookable && firstInteractionWasBookingRequest;
        firstInteractionWasNotBookingRequest = !firstInteractionWasBookingRequest; //!parsedBookingRequestSubmittedTime ||  parsedFirstInteractionTime < parsedBookingRequestSubmittedTime;
        hostNeverResponded                   = !wasBookedInstantly && !parsedHostRepliedTime && !parsedHostAcceptedTime;
        hostResponded                        = !wasBookedInstantly && !!parsedHostRepliedTime || !!parsedHostAcceptedTime;
        hostAccepted                         = !!parsedHostAcceptedTime;
        hostRejected                         = !wasBookedInstantly && guestRequestedBooking && !!parsedHostRepliedTime && !parsedHostAcceptedTime;
        guestRepliedAfterHostAccepted        = parsedHostAcceptedTime  && parsedBookingTime > parsedHostAcceptedTime;

        if (wasBookedInstantly) {
            currLink = linksData['Guest requested booking']['Booked instantly'] =
                      (linksData['Guest requested booking']['Booked instantly'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            currLink = linksData['Booked instantly']['Successful booking'] =
                      (linksData['Booked instantly']['Successful booking'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;
        }

        if (firstInteractionWasNotBookingRequest && hostNeverResponded) {
            currLink = linksData['Guest contacted host']['Host did not reply'] =
                      (linksData['Guest contacted host']['Host did not reply'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            currLink = linksData['Host did not reply']['Un-successful booking'] =
                      (linksData['Host did not reply']['Un-successful booking'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;
        }

        if (firstInteractionWasNotBookingRequest && hostResponded) {
            currLink = linksData['Guest contacted host']['Host replied'] =
                      (linksData['Guest contacted host']['Host replied'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            if (!parsedBookingRequestSubmittedTime) {
                currLink = linksData['Host replied']['Un-successful booking'] =
                          (linksData['Host replied']['Un-successful booking'] || { count: 0, sumTimeBetween: 0 });
                currLink.count++;
            }
        }

        if (firstInteractionWasNotBookingRequest &&
            parsedBookingRequestSubmittedTime &&
            parsedFirstInteractionTime < parsedBookingRequestSubmittedTime) {
            currLink = linksData['Host replied']['Guest requested booking'] =
                      (linksData['Host replied']['Guest requested booking'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;
        }

        if (firstInteractionWasBookingRequest && hostNeverResponded) {
            currLink = linksData['Guest requested booking']['Host did not reply'] =
                      (linksData['Guest requested booking']['Host did not reply'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            currLink = linksData['Host did not reply']['Un-successful booking'] =
                      (linksData['Host did not reply']['Un-successful booking'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;
        }
        if (guestRequestedBooking && hostRejected) {
            currLink = linksData['Guest requested booking']['Host rejected booking request'] =
                      (linksData['Guest requested booking']['Host rejected booking request'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            currLink = linksData['Host rejected booking request']['Un-successful booking'] =
                      (linksData['Host rejected booking request']['Un-successful booking'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;
        }
        if (guestRequestedBooking && hostAccepted) {
            currLink = linksData['Guest requested booking']['Host accepted booking request'] =
                      (linksData['Guest requested booking']['Host accepted booking request'] || { count: 0, sumTimeBetween: 0 });
            currLink.count++;

            // if (!guestRepliedAfterHostAccepted) {
                currLink = linksData['Host accepted booking request']['Successful booking'] =
                          (linksData['Host accepted booking request']['Successful booking'] || { count: 0, sumTimeBetween: 0 });
                currLink.count++;
            // }
        }
        // if (hostAccepted && guestRepliedAfterHostAccepted) {
        //     currLink = linksData['Host accepted booking request']['Guest updated booking'] =
        //               (linksData['Host accepted booking request']['Guest updated booking'] || { count: 0, sumTimeBetween: 0 });
        //     currLink.count++;

        //     currLink = linksData['Guest updated booking']['Successful booking'] =
        //               (linksData['Guest updated booking']['Successful booking'] || { count: 0, sumTimeBetween: 0 });
        //     currLink.count++;
        // }
    }
    console.log("total interactions", total);
    return {
        nodes: nodes,
        links: makeLinks(linksData)
    };
};

function _parseListings(rawData) {
    console.log("listings sample", rawData[0])
    var listings = {};

    var cf = listings.crossfilter = crossfilter(rawData);

    var dims = listings.dims = {
        dateCreated:     cf.dimension(function(d) { return monthDayYear(d.date_created); }),
        location:        cf.dimension(function(d) { return [+d.approx_longitude, +d.approx_latitude]; }),
        bedrooms:        cf.dimension(function(d) { return +d.bedrooms; }),
        // bathrooms:       cf.dimension(function(d) { return +d.bathrooms; }),
        capacity:        cf.dimension(function(d) { return +d.person_capacity; }),
        instantBookable: cf.dimension(function(d) { return +d.instant_bookable ? "Yes" : "No"; }),
        type:            cf.dimension(function(d) { return d.listing_type; })
    };

    var groups = listings.groups = {
        dateCreated: dims.dateCreated.group(),
        location:    dims.location.group(), //.reduce(reduceAddTotal, reduceRemoveTotal, reduceInitTotal),
        capacity:    dims.capacity.group(),
        type:        dims.type.group(),
        instantBookable: dims.instantBookable.group(),
        bedrooms:   dims.bedrooms.group(),
        // bathrooms:  dims.bathrooms.group(),
    };

    groups.locationTotals = {};
    groups.location.top(Infinity).forEach(function(d) {
        groups.locationTotals[ d.key ] = groups.locationTotals[ d.key ] || 0;
        groups.locationTotals[ d.key ] += d.value;
    });

    // groups.locationMovingAverage = crossfilter$ma.accumulateGroupForNDayMovingAverage(
    //     groups.location,
    //     10
    // );

    return listings;
}

function _parseInteractions(rawData) {
    rawData = rawData.filter(function(d) { return d.first_interaction_time_utc; });
    console.log("interaction sample", rawData[0])

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
        timeToReply: cf.dimension(function(d) {
            var firstInteraction = yearMonthDayHourMinuteSecond(d.first_interaction_time_utc);
            var firstReply       = yearMonthDayHourMinuteSecond(d.first_reply_time_utc);

            if (firstInteraction !== null &&
                firstReply !== null) {
                var nearestHour = Math.round((firstReply - firstInteraction) / hourInMs) * hourInMs;
                var nHours = nearestHour / hourInMs;

                return nHours;
            }
            else {
                return -1;
            }
        }),
        daysInAdvanceRequested: cf.dimension(function(d) {
            var firstInteraction = d3.time.day(yearMonthDayHourMinuteSecond(d.first_interaction_time_utc));
            var checkinDate      = yearMonthDay(d.checkin_date);

            if (firstInteraction !== null &&
                checkinDate !== null) {

                // var nearestDay = Math.round((firstReply - firstInteraction) / hourInMs) * hourInMs;
                var nDays = (checkinDate - firstInteraction) / dayInMs;

                return nDays;
            }
            else {
                return -1;
            }
        }),
        // requestsPerUserPerDate: cf.

        // requests perlisting, percheckin,

    };

    var groups = interactions.groups = {
        checkinDate: dims.checkinDate.group(),
        firstInteraction: dims.firstInteraction.group(),
        nights: dims.nights.group(),
        guests: dims.guests.group(),
        timeToReply: dims.timeToReply.group(),
        daysInAdvanceRequested: dims.daysInAdvanceRequested.group()
        // success: dims.success.group().reduce(reduceAddAvg, reduceRemoveAvg, reduceInitAvg, "")
    };



    return interactions;
}


function reduceAddTotal(p,v,attr) {
  ++p.count;
  ++p.total;
  return p;
}
function reduceRemoveTotal(p,v,attr) {
  --p.count;
  return p;
}
function reduceInitTotal() {
  return { count: 0, total: 0 };
}
