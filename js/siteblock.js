// Copyright 2012 Constantine Sapuntzakis
//

const siteblock = {
      read_options(stg) {
         const opts = "settings" in stg ? JSON.parse(stg['settings']) : {};
         const { rules = "", allowed = 0, period = 1440 } = opts;
         return { ...opts, rules, allowed, period };
      },

      newUsageTracker() {
         let time_cb = () => Date.now() / 1000;

         let time_allowed = 0;
         let time_period = 3600;

         let time_used = 0;

         let last_start = -1;
         let last_end = -1;

         const check_reset = (now) => {
            if (last_end != -1 &&
               (now - last_end) >= (time_period - time_allowed)) {
               time_used = 0;
            }
         };

         const get_time_used = () => {
            const time = time_cb();

            check_reset(time);

            // If we're in an existing interval, count it
            let time_adj = 0;
            if (last_start != -1 && time > last_start && time < last_start + 120)
               time_adj = (time - last_start);

            return (time_used + time_adj);
         };

         const self = {
            onBlockedSiteAllowed() {
               if (last_start == -1) {
                  last_start = time_cb();
               }
            },

            onLastBlockedDone() {
               self.updateTimeUsed();
               last_start = -1;
            },

            updateTimeUsed() {
               if (last_start != -1) {
                  const end = time_cb();
                  if (end > last_start + 120) {
                     // Don't count the time
                  } else if (end > last_start) {
                     time_used += (end - last_start);
                  }

                  last_start = end;
                  last_end = end;
               }
            },

            allowed() {
               return get_time_used() < time_allowed;
            },

            setInterval(allowed, period) {
               time_allowed = allowed * 60;
               time_period = period * 60;
            },

            setTimeCallback(new_cb) {
               time_cb = new_cb;
            },

            getState() {
               return { time_used, last_start, last_end };
            },

            setState(st) {
               time_used = st.time_used;
               last_start = ("last_start" in st) ? st.last_start : -1;
               last_end = st.last_end;
            },
         };

         return self;
      },

      newSiteBlock() {
         let path_white = [];
         let path_black = [];

         let tracked_tabs = [];

         const ut = siteblock.newUsageTracker();

         const self = {
            updatePaths(paths) {
               if (paths === undefined)
                  return;

               path_white = [];
               path_black = [];

               for (let p of paths.split("\n")) {
                  if (p.match(/^\s*$/))
                     continue;

                  let add = path_black;
                  if (p[0] === '+') {
                     p = p.slice(1);
                     add = path_white;
                  }
                  p = p.replace(/\./g, '\\.').replace(/\*/g, '.*');
                  add.push(new RegExp(p, 'ig'));
               }
            },

            isBlocked(url) {
               let blocked = false;

               if (url !== undefined && url.match(/https?:/)) {
                  for (const pattern of path_black) {
                     if (url.search(pattern) != -1) {
                        blocked = true;
                        break;
                     }
                  }
                  for (const pattern of path_white) {
                     if (url.search(pattern) != -1) {
                        blocked = false;
                        break;
                     }
                  }
               }

               return blocked;
            },  // isBlocked

            setAllowedUsage: ut.setInterval,

            setTimeCallback: ut.setTimeCallback,

            getState() {
               return {
                  ut: ut.getState(),
                  tabs: tracked_tabs.slice(),
               };
            },

            setState(st) {
               if ("ut" in st) {
                  ut.setState(st.ut);
               }
               if ("tabs" in st) {
                  tracked_tabs = st.tabs.slice();
               }
            },

            startTracking(tabid) {
               if (!tracked_tabs.includes(tabid)) {
                  tracked_tabs.push(tabid);
               }
            },

            stopTracking(tabid) {
               const idx = tracked_tabs.indexOf(tabid);
               if (idx != -1) {
                  tracked_tabs.splice(idx, 1);
                  return true;
               }
               return false;
            },

            emptyTracking() {
               return tracked_tabs.length == 0;
            },

            blockThisTabChange(tabid, url) {
               const blocked = (url !== null) ? self.isBlocked(url) : false;
               const allowed = ut.allowed();

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

            getBlockedTabs() {
               if (ut.allowed()) {
                  return [];
               }

               return tracked_tabs.slice();
            },

            updateTimeUsed() {
               ut.updateTimeUsed();
            },
         }; // self =

         return self;
      } // newSiteBlock
};

export default { siteblock };
