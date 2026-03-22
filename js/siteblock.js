// Copyright 2012 Constantine Sapuntzakis
//

class UsageTracker {
   #time_cb = () => Date.now() / 1000;
   #time_allowed = 0;
   #time_period = 3600;
   #time_used = 0;
   #last_start = -1;
   #last_end = -1;

   #check_reset(now) {
      if (this.#last_end != -1 &&
         (now - this.#last_end) >= (this.#time_period - this.#time_allowed)) {
         this.#time_used = 0;
      }
   }

   #get_time_used() {
      const time = this.#time_cb();
      this.#check_reset(time);
      // If we're in an existing interval, count it
      let time_adj = 0;
      if (this.#last_start != -1 && time > this.#last_start && time < this.#last_start + 120)
         time_adj = (time - this.#last_start);
      return (this.#time_used + time_adj);
   }

   onBlockedSiteAllowed = () => {
      if (this.#last_start == -1) {
         this.#last_start = this.#time_cb();
      }
   }

   onLastBlockedDone = () => {
      this.updateTimeUsed();
      this.#last_start = -1;
   }

   updateTimeUsed = () => {
      if (this.#last_start != -1) {
         const end = this.#time_cb();
         if (end > this.#last_start + 120) {
            // Don't count the time
         } else if (end > this.#last_start) {
            this.#time_used += (end - this.#last_start);
         }
         this.#last_start = end;
         this.#last_end = end;
      }
   }

   allowed = () => this.#get_time_used() < this.#time_allowed;

   setInterval = (allowed, period) => {
      this.#time_allowed = allowed * 60;
      this.#time_period = period * 60;
   }

   setTimeCallback = (new_cb) => {
      this.#time_cb = new_cb;
   }

   getState = () => ({
      time_used: this.#time_used,
      last_start: this.#last_start,
      last_end: this.#last_end,
   });

   setState = (st) => {
      this.#time_used = st.time_used;
      this.#last_start = ("last_start" in st) ? st.last_start : -1;
      this.#last_end = st.last_end;
   }
}

class SiteBlock {
   #path_white = [];
   #path_black = [];
   #tracked_tabs = [];
   #ut = new UsageTracker();

   updatePaths = (paths) => {
      if (paths === undefined)
         return;

      this.#path_white = [];
      this.#path_black = [];

      for (let p of paths.split("\n")) {
         if (p.match(/^\s*$/))
            continue;

         let add = this.#path_black;
         if (p[0] === '+') {
            p = p.slice(1);
            add = this.#path_white;
         }
         p = p.replace(/\./g, '\\.').replace(/\*/g, '.*');
         add.push(new RegExp(p, 'ig'));
      }
   }

   isBlocked = (url) => {
      let blocked = false;

      if (url !== undefined && url.match(/https?:/)) {
         for (const pattern of this.#path_black) {
            if (url.search(pattern) != -1) {
               blocked = true;
               break;
            }
         }
         for (const pattern of this.#path_white) {
            if (url.search(pattern) != -1) {
               blocked = false;
               break;
            }
         }
      }

      return blocked;
   }

   setAllowedUsage = (allowed, period) => this.#ut.setInterval(allowed, period);

   setTimeCallback = (new_cb) => this.#ut.setTimeCallback(new_cb);

   getState = () => ({
      ut: this.#ut.getState(),
      tabs: this.#tracked_tabs.slice(),
   });

   setState = (st) => {
      if ("ut" in st)
         this.#ut.setState(st.ut);
      if ("tabs" in st)
         this.#tracked_tabs = st.tabs.slice();
   }

   startTracking = (tabid) => {
      if (!this.#tracked_tabs.includes(tabid))
         this.#tracked_tabs.push(tabid);
   }

   stopTracking = (tabid) => {
      const idx = this.#tracked_tabs.indexOf(tabid);
      if (idx != -1) {
         this.#tracked_tabs.splice(idx, 1);
         return true;
      }
      return false;
   }

   emptyTracking = () => this.#tracked_tabs.length == 0;

   blockThisTabChange = (tabid, url) => {
      const blocked = (url !== null) ? this.isBlocked(url) : false;
      const allowed = this.#ut.allowed();

      if (blocked) {
         this.startTracking(tabid);
         if (allowed)
            this.#ut.onBlockedSiteAllowed();
      } else if (this.stopTracking(tabid) && this.emptyTracking()) {
         this.#ut.onLastBlockedDone();
      }

      return blocked && !allowed;
   }

   getBlockedTabs = () => {
      if (this.#ut.allowed())
         return [];
      return this.#tracked_tabs.slice();
   }

   updateTimeUsed = () => this.#ut.updateTimeUsed();
}

function read_options(stg) {
   const opts = "settings" in stg ? JSON.parse(stg['settings']) : {};
   const { rules = "", allowed = 0, period = 1440 } = opts;
   return { ...opts, rules, allowed, period };
}

const siteblock = {
   read_options,
   newSiteBlock: () => new SiteBlock(),
   newUsageTracker: () => new UsageTracker(),
};

export default { siteblock };
