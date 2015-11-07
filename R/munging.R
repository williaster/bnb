library(ggplot2)

setwd("~/Dropbox/experience/airbnb/R/")

# Helpers to convert dates
setClass("asDateTime")
setAs("character","asDateTime", function(from) as.POSIXct(from, format="%Y-%m-%d %H:%M:%OS"))

setClass("asDay")
setAs("character","asDay", function(from) as.POSIXlt(from, format="%Y-%m-%d"))

setClass("asMonth")
setAs("character","asMonth", function(from) as.POSIXlt(from, format="%Y-%m"))

#....................................................................................
# Load files
f.interactions <- "../data/interactions.csv"
f.listings     <- "../data/listings.csv"
f.out.joined   <- "../data/joined.csv"

df.interactions <- read.csv(f.interactions,
                            colClasses=c(
                              "factor", # id_guest
                              "factor",  # guest_origin_contry
                              "factor", # id_host
                              "factor", # id_guest
                              "asDay",   # checkin_date
                              "numeric", # nights
                              "numeric", # guests
                              "asDateTime", # first_interaction_time_utc
                              "asDateTime", # first_reply_time_utc
                              "asDateTime", # booking_request_submitted_time_utc
                              "asDateTime", # host_accepted_time_utc
                              "asDateTime", # booking_time
                              "numeric"     # n_interactions
                            ))  
df.listings <- read.csv(f.listings,
                        colClasses=c(
                          "factor",  # id_listing
                          "factor",  # id_host
                          "asDay",   # date_created
                          "factor",  # listing_type
                          "numeric", # person_capacity
                          "numeric", # bedrooms
                          "numeric", # bathrooms
                          "numeric", # beds
                          "numeric", # lat
                          "numeric", # long
                          "numeric"  # instant_bookable
                        ))

df.joined <- merge(df.interactions, df.listings, all=FALSE, by=c("id_host", "id_listing")) 

write.csv(df.joined, f.out.joined)

# Compute some new metrics
# add column "was successful"
#   if instant and initial_interaction
#   if not-instant and host accepted 
#   


# SUPPLY
#   quantity
#     - new listings
#         per unit time (date_created)
#         % change compared to some unit time
#         
#     - total listings
#         naive approach is to assume all past still active
#         better: heuristic of booking within the last x amount of time (metric = max time per booking)
#
#   attributes (cross filter)
#     - size (person_capacity, #bedrooms, #bathrooms)
#     - type
#     - location
# 
#   quality
#     - time to first successful booking?? (reflects desirability? --> location, types)
#     - avg reply rate (reflects host)
#     - time to first reply (reflects host)
#     - requests per checkin date 
#         (checkin + listing_id, caveat should account for number of nights)
#     - delta between guests and person_capacity (reflects quality of match)
#     - requests per guest per checkin date 

# DEMAND
#   quantity
#     - new guest_ids per unit time (**need min first_interaction_time for each guest)
#     - 
#   attributes
#     - country of orign
#     - avg guests
#     - avg nights
#     - delta between request and checkin_date





# Simple
#   quantity of supply and demand
#   distribution of reply rates
#   distribution of time to reply

# Exploratory
#   attributes

# if you select a time in exploratory
#   should filter to checkins in that time range, or new listings in that time range

#   map 
#     lat/long location
#     size - ct new listings in selected time period
#     color - total listings 
#       if select entire time range, color and size should match?
#     hover 
#     select particular region filters to that lat/long, keeping time fixed?
#     cross filters -- would filter 
  



# quality of match (delta between guests and person_capacity)
#   
# quality of host
#   
# quality of listing
#   


#   ct uniuqe id_listing per (time), compare to previous time 
#       (i|a, else round to month and use that)
#       (good as a number, potential seasonal fluctuations?)
#   
#   reply rate for a given id_host (ct events )



# DEMAND
#   ct unique id_guest per first_interaction (day, month, etc)

# SUPPLY-DEMAND
#   number of requests per checkin_date (group by checkin_date, count id_guest)
# 

# first_interaction  first_reply  booking_request  host_accepted  booking_time
# x  
# 
#
#




