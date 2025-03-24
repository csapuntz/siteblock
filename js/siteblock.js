// Copyright 2012 Constantine Sapuntzakis
//

if (typeof csapuntz == "undefined") {
   var csapuntz = {};
}

csapuntz.siteblock = (function () {
   var sbself = {
      read_options: function (stg) {
         var opts = {};

         if ("settings" in stg) {
            opts = JSON.parse(stg['settings']);
         }

         if (!("rules" in opts))
            opts.rules = "";

         if (!("allowed" in opts))
            opts.allowed = 0;

         if (!("period" in opts))
            opts.period = 1440;

         return opts;
      },

      newUsageTracker: function () {
         var time_cb = function () {
            var d = new Date();

            return d.getTime() / 1000;
         };

         var time_allowed = 0;
         var time_period = 3600;

         var time_used = 0;

         var last_start = -1;
         var last_end = -1;

         var check_reset = function (now) {
            if (last_end != -1 &&
               (now - last_end) >= (time_period - time_allowed)) {
               time_used = 0;
            }
         }

         var get_time_used = function () {
            var time = time_cb();

            check_reset(time);

            // If we're in an existing interval, count it
            var time_adj = 0;
            if (last_start != -1 && time > last_start && time < last_start + 120)
               time_adj = (time - last_start);

            return (time_used + time_adj);
         };

         var self = {
            onBlockedSiteAllowed: function () {
               if (last_start == -1) {
                  last_start = time_cb();
               }
            },

            onLastBlockedDone: function () {
               self.updateTimeUsed();
               last_start = -1;
            },

            updateTimeUsed: function () {
               if (last_start != -1) {
                  var end = time_cb();
                  if (end > last_start + 120) {
                     // Don't count the time
                  } else if (end > last_start) {
                     time_used += (end - last_start);
                  }

                  last_start = end;
                  last_end = end;
               }
            },

            allowed: function () {
               return get_time_used() < time_allowed;
            },

            setInterval: function (allowed, period) {
               time_allowed = allowed * 60;
               time_period = period * 60;
            },

            setTimeCallback: function (new_cb) {
               time_cb = new_cb;
            },

            getState: function () {
               return {
                  "time_used": time_used,
                  "last_start": last_start,
                  "last_end": last_end,
               };
            },

            setState: function (st) {
               time_used = st.time_used;
               last_start = ("last_start" in st) ? st.last_start : -1;
               last_end = st.last_end;
            },
         };

         return self;
      },

      newSiteBlock: function () {
         var path_white;
         var path_black;

         var tracked_tabs = [];

         var ut = sbself.newUsageTracker();

         var self = {
            updatePaths: function (paths) {
               if (paths === undefined)
                  return;

               paths = paths.split("\n");
               path_white = new Array();
               path_black = new Array();

               for (var i = 0; i < paths.length; ++i) {
                  var p = paths[i];
                  if (p.match(/^\s*$/)) {
                  } else {
                     var add = path_black;
                     if (p[0] == '+') {
                        p = p.substr(1);
                        add = path_white;
                     }
                     p = p.replace('.', '\\.');
                     p = p.replace('*', '.*');
                     add.push(new RegExp(p, 'ig'));
                  }
               }
            },

            isBlocked: function (url) {
               var blocked = false;

               if (url !== undefined && url.match(/https?:/)) {
                  var p;
                  for (p in path_black) {
                     if (url.search(path_black[p]) != -1) {
                        blocked = true;
                        break;
                     }
                  }
                  for (p in path_white) {
                     if (url.search(path_white[p]) != -1) {
                        blocked = false;
                        break;
                     }
                  }
               }

               return blocked;
            },  // isBlocked

            setAllowedUsage: ut.setInterval,

            setTimeCallback: ut.setTimeCallback,

            getState: function () {
               return {
                  "ut": ut.getState(),
                  "tabs": tracked_tabs.slice(),
               };
            },

            setState: function (st) {
               if ("ut" in st) {
                  ut.setState(st.ut);
               }
               if ("tabs" in st) {
                  tracked_tabs = st.tabs.slice();
               }
            },

            startTracking: function (tabid) {
               if (!tracked_tabs.includes(tabid)) {
                  tracked_tabs.push(tabid);
               }
            },

            stopTracking: function (tabid) {
               var idx = tracked_tabs.indexOf(tabid);
               if (idx != -1) {
                  tracked_tabs.splice(idx, 1);
                  return true;
               }
               return false;
            },

            emptyTracking: function () {
               return tracked_tabs.length == 0;
            },

            blockThisTabChange: function (tabid, url) {
               var blocked = (url !== null) ? self.isBlocked(url) : false;
               var allowed = ut.allowed();

               if (blocked) {
                  self.startTracking(tabid);

                  if (allowed) {
                     ut.onBlockedSiteAllowed();
                  }
               } else if (self.stopTracking(tabid) && self.emptyTracking()) {
                  ut.onLastBlockedDone();
               }

               return blocked && !allowed;
            },

            getBlockedTabs: function () {
               if (ut.allowed()) {
                  return [];
               }

               return tracked_tabs.slice();
            },

            updateTimeUsed: function () {
               ut.updateTimeUsed();
            },
         }; // self =

         return self;
      } // newSiteBlock
   }; // self =

   return sbself;
})();

export default csapuntz;
