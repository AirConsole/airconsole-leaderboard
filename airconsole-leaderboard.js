function AirConsoleLeaderboard(airconsole, config) {
  this.airconsole = airconsole;
  config = config || {}
  this.best_of_default = config["best_of"] || 3;
  this.onHide = config["onHide"];
  this.show_at_start_up = config["show"] == undefined ? true : config["show"];
  this.scores = {};
  this.root = document.getElementById("airconsole-leaderboard");
  this.best_of_choices = config["best_of_choices"] || [3, 5, 7]
  this.visible = false;
}

AirConsoleLeaderboard.prototype.addPoints = function(device_id, points) {
  if (this.airconsole.device_id == AirConsole.SCREEN) {
    if (points === undefined) {
      points = 1;
    }
    points = (this.scores[device_id] || 0) + points;
    this.scores[device_id] = points;
    return (points >= this.getLeaderboardData_()["best_of"]);
  } else {
    throw "Only screen can add points!";
  }
};

AirConsoleLeaderboard.prototype.show = function() {
  if (this.airconsole.device_id == AirConsole.SCREEN) {
    this.screenShow_();
  } else {
    var data = this.getLeaderboardData_();
    data["request"] = true;
    this.setLeaderboardData_(data);
    this.showOrHide_();
  }
};

AirConsoleLeaderboard.prototype.onReady = function(code) {
  if (this.airconsole.device_id == AirConsole.SCREEN) {
    if (this.show_at_start_up) {
      this.screenShow_();
    } else {
      this.screenHide_()
    }
  } else {
    var me = this;
    window.addEventListener("resize", function() {
      me.checkOrientation_();
    });
    window.addEventListener("orientationchange", function() {
      me.checkOrientation_();
    });
    this.setLeaderboardData_({});
  }
  this.showOrHide_();
};


AirConsoleLeaderboard.prototype.onDeviceStateChange = function(from, data) {
  var screen_data = this.getLeaderboardData_(AirConsole.SCREEN);
  if (this.airconsole.device_id == AirConsole.SCREEN) {
    var controller_data = this.getLeaderboardData_(from);
    if (controller_data["request"]) {
      this.screenShow_();
    }
    if (controller_data["best_of"]) {
      this.requestBestOf_(controller_data["best_of"])
    }
    if (screen_data["visible"]) {
      var all_accepted = true;
      for (var i = 1; i < this.airconsole.devices.length; ++i) {
        controller_data = this.getLeaderboardData_(i);
        if (controller_data["generation"] != screen_data["generation"] ||
            !this.deviceInitializedOrGone_(i)) {
          all_accepted = false;
          break;
        }
      }
      if (all_accepted) {
        this.screenHide_();
      }
    }
  } else if (from == AirConsole.SCREEN) {
    var controller_data = this.getLeaderboardData_();
    if (screen_data["visible"]) {
      if (controller_data["request"]) {
        delete controller_data["request"];
        this.setLeaderboardData_(controller_data)
      }
    }
    if (controller_data["best_of"] == screen_data["best_of"]) {
      delete controller_data["best_of"];
      this.setLeaderboardData_(controller_data)
    }
    this.showOrHide_();
  }
};

AirConsoleLeaderboard.prototype.hide = function() {
  if (this.visible) {
    this.removeClass_(this.root, "airconsole-leaderboard-show");
    this.visible = false;
    if (this.onHide) {
      this.onHide();
    }
  }
};

AirConsoleLeaderboard.prototype.addClass_ = function(el, name) {
  var classes = el.className.split(" ");
  for (var i = 0; i < classes.length; ++i) {
    if (classes[i] == name) {
      return;
    }
  }
  if (el.className) {
    el.className += " " + name;
  } else {
    el.className = name;
  }
};

AirConsoleLeaderboard.prototype.removeClass_ = function(el, name) {
  var classes = el.className.split(" ");
  var removed = [];
  for (var i = 0; i < classes.length; ++i) {
    if (classes[i] != name) {
      removed.push(classes[i]);
    }
  }
  el.className = removed.join(" ");
};

AirConsoleLeaderboard.prototype.checkOrientation_ = function() {
  if (this.root.offsetHeight > this.root.offsetWidth) {
    this.addClass_(this.root, "airconsole-leaderboard-portrait");
    this.removeClass_(this.root, "airconsole-leaderboard-landscape");
  } else {
    this.addClass_(this.root, "airconsole-leaderboard-landscape");
    this.removeClass_(this.root, "airconsole-leaderboard-portrait");
  }
}

AirConsoleLeaderboard.prototype.getLeaderboardData_ = function(device_id) {
  if (device_id == undefined) {
    device_id = this.airconsole.device_id;
  }
  var data = this.airconsole.getCustomDeviceState(device_id);
  if (data === undefined) {
    data = {};
  }
  if (typeof data != "object") {
    throw "CustomDeviceState needs to be of type object!";
  }
  return data["airconsole-leaderboard"] || {};
};

AirConsoleLeaderboard.prototype.setLeaderboardData_ = function(leaderboard) {
  var data = this.airconsole.getCustomDeviceState(
      this.airconsole.device_id) || {};
  data["airconsole-leaderboard"] = leaderboard;
  this.airconsole.setCustomDeviceState(data);
};

AirConsoleLeaderboard.prototype.screenShow_ = function() {
  var data = this.getLeaderboardData_();
  data["generation"] = new Date().getTime();
  data["scores"] = this.scores;
  data["visible"] = true;
  if (!data["best_of"]) {
    data["best_of"] = this.best_of_default;
  }
  this.setLeaderboardData_(data);
  this.showOrHide_();
};

AirConsoleLeaderboard.prototype.screenHide_ = function() {
  var data = this.getLeaderboardData_();
  data["visible"] = false;
  this.setLeaderboardData_(data);
  this.showOrHide_();
};

AirConsoleLeaderboard.prototype.deviceInitializedOrGone_ = function(
    device_id) {
  if (!this.airconsole.devices[device_id]) {
    return true;
  }
  var data = this.airconsole.getCustomDeviceState(device_id);
  if (!data || !data["airconsole-leaderboard"]) {
    return false;
  }
  return true;
}

AirConsoleLeaderboard.prototype.requestBestOf_ = function(best_of) {
  if (this.airconsole.device_id == AirConsole.SCREEN) {
    var pregame = true;
    for (var i = 1; i < this.airconsole.devices.length; ++i) {
      if (this.scores[i]) {
        pregame = false;
        break;
      }
    }
    if (pregame) {
      var data = this.getLeaderboardData_(AirConsole.SCREEN);
      data["best_of"] = best_of;
      this.setLeaderboardData_(data);
    }
  } else {
    var controller_data = this.getLeaderboardData_();
    controller_data["best_of"] = best_of;
    this.setLeaderboardData_(controller_data);
  }
};

AirConsoleLeaderboard.prototype.showOrHide_ = function() {
  var screen_data = this.getLeaderboardData_(AirConsole.SCREEN);
  var controller_data = this.getLeaderboardData_(this.airconsole.device_id);
  var visible = screen_data["visible"];
  if (visible == undefined) {
    visible = true;
  }
  if (visible || screen_data["request"] ||
    controller_data["generation"] != screen_data["generation"]) {
    this.render_(screen_data, controller_data);
  } else {
    this.hide();
  }
}

AirConsoleLeaderboard.prototype.render_ = function(screen_data,
                                                   controller_data) {
  if (!this.visible) {
    this.visible = true;
    this.addClass_(this.root, "airconsole-leaderboard-show");
    var me= this;
    window.setTimeout(function() {
      me.checkOrientation_()
    });
  }
  if (airconsole.device_id == AirConsole.SCREEN) {
    this.renderScreen_(screen_data);
  } else {
    this.renderController_(screen_data, controller_data);
  }
};

AirConsoleLeaderboard.prototype.renderScreen_ = function(screen_data) {

};

AirConsoleLeaderboard.prototype.createControllerBestOf = function(best_of) {
  var button = document.createElement("div");
  button.className = "airconsole-leaderboard-controller-best-of-button";
  button.innerText = "BEST OF " + best_of;
  var me = this;
  button.addEventListener("touchstart", function() {
    me.requestBestOf_(best_of)
  });
  this.controller_best_of_buttons.push(button);
  this.controller_best_of_container.appendChild(button);
}

AirConsoleLeaderboard.prototype.renderController_ = function(screen_data,
                                                             controller_data) {
  var me = this;
  if (!this.controller_start) {
    this.controller_queue = document.createElement("div");
    this.controller_queue.className =
        "airconsole-leaderboard-controller-queue";
    this.controller_queue.innerHTML = "<span>Waiting</span> for next round";
    this.root.appendChild(this.controller_queue);
    this.controller_place = document.createElement("div");
    this.controller_place.className =
        "airconsole-leaderboard-controller-place";
    this.controller_place_text = document.createElement("div");
    this.controller_place.appendChild(this.controller_place_text);
    var pic = document.createElement("div");
    pic.className = "airconsole-leaderboard-controller-place-picture";
    pic.style.backgroundImage =
        "url('" + this.airconsole.getProfilePicture(
        this.airconsole.device_id, 96) + "')";
    this.controller_place.appendChild(pic);
    this.root.appendChild(this.controller_place);
    this.controller_best_of_container = document.createElement("div");
    this.controller_best_of_container.className =
        "airconsole-leaderboard-controller-best-of";
    this.controller_best_of_container.innerHTML = "SELECT A MODE<br>"
    this.root.appendChild(this.controller_best_of_container);
    this.controller_best_of_buttons = [];
    for (var i = 0; i < this.best_of_choices.length; ++i) {
      this.createControllerBestOf(this.best_of_choices[i]);
    }
    this.controller_start = document.createElement("div");
    this.controller_start.className =
        "airconsole-leaderboard-controller-start";
    this.controller_start.innerText = "START";
    this.controller_start.addEventListener("touchstart", function() {
      var controller_data = me.getLeaderboardData_();
      var screen_data = me.getLeaderboardData_(AirConsole.SCREEN);
      controller_data["generation"] = screen_data["generation"];
      me.setLeaderboardData_(controller_data);
      me.showOrHide_();
    });
    this.root.appendChild(this.controller_start);
  }
  this.controller_place.style.display = "none";
  this.controller_best_of_container.style.display = "none";
  if (screen_data["visible"]) {
    this.controller_queue.style.display = "none";
    this.controller_start.style.display = "block";
    if (screen_data["generation"] != controller_data["generation"]) {
      this.removeClass_(this.controller_start,
                        "airconsole-leaderboard-controller-start-ready");
    } else {
      this.addClass_(this.controller_start,
                     "airconsole-leaderboard-controller-start-ready");
      this.controller_queue.style.display = "none";
    }
    var score_rank = [];
    var highest_score = 0;
    for (var i = 1; i < this.airconsole.devices.length; ++i) {
      if (this.airconsole.devices[i]) {
        var score = screen_data.scores[i] || 0
        highest_score = Math.max(score, highest_score);
        score_rank.push(score)
      }
    }
    score_rank.sort(function(a, b){return b-a});
    if (highest_score) {
      var my_score = screen_data.scores[me.airconsole.device_id] || 0;
      for (var i = 0; i < score_rank.length; ++i) {
        if (my_score == score_rank[i]) {
          var my_rank = (i+1);
          var suffix = "th";
          if (my_rank % 10 == 1 && my_rank != 11) {
            suffix = "st";
          } else if (my_rank % 10 == 2 && my_rank != 12) {
            suffix = "nd";
          } else if (my_rank % 10 == 3 && my_rank != 13) {
            suffix = "rd";
          }
          this.controller_place_text.innerHTML =
              my_rank + suffix + " place";
          break;
        }
      }
      this.controller_place.style.display = "block";
    } else {
      this.controller_best_of_container.style.display = "block";
    }
    for (var i = 0; i < this.best_of_choices.length; ++i) {
      var button = this.controller_best_of_buttons[i];
      if (screen_data["best_of"] == this.best_of_choices[i]) {
        this.addClass_(button,
            "airconsole-leaderboard-controller-best-of-button-active");
      } else {
        this.removeClass_(button,
             "airconsole-leaderboard-controller-best-of-button-active");
      }
    }
  } else {
    this.controller_start.style.display = "none";
    this.controller_queue.style.display = "block";
  }
};