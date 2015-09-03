function AirConsoleLeaderboard(airconsole, config) {
  this.airconsole = airconsole;
  config = config || {}
  this.best_of_default = config["best_of"] || 3;
  this.countdown_seconds = config["countdown"] || 5;
  this.onHide = config["onHide"];
  this.show_at_start_up = config["show"] == undefined ? true : config["show"];
  this.scores = {};
  this.root = document.getElementById("airconsole-leaderboard");
  this.best_of_choices = config["best_of_choices"] || [3, 5, 7]
  this.visible = false;
  this.instructions = document.getElementById(
      "airconsole-leaderboard-instructions");
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
    this.screen_player_ready = {};
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
    if (screen_data["best_of"] == 0 && this.airconsole.devices.length > 2) {
      screen_data["best_of"] = this.best_of_default;
      this.scores = {};
      screen_data["scores"] = this.scores;
      this.setLeaderboardData_(screen_data);
    }
    if (controller_data["request"]) {
      this.screenShow_();
    }
    if (controller_data["best_of"]) {
      this.requestBestOf_(controller_data["best_of"])
    }
    if (screen_data["visible"]) {
      var all_accepted = true;
      var one_accepted = false;
      var max_score = 0;
      for (var i = 1; i < this.airconsole.devices.length; ++i) {
        if (!this.airconsole.devices[i]) {
          continue;
        }
        max_score = Math.max(max_score, this.scores[i] || 0);
        controller_data = this.getLeaderboardData_(i);
        if (controller_data["generation"] != screen_data["generation"] ||
            !this.deviceInitializedOrGone_(i)) {
          all_accepted = false;
        } else {
          one_accepted = true;
        }
      }
      if (all_accepted) {
        this.screenHide_(max_score >= screen_data["best_of"]);
      } else if (one_accepted && !this.countdown) {
        var me = this;
        this.countdown = window.setTimeout(function() {
          var latest_screen_data = me.getLeaderboardData_();
          latest_screen_data["force"] = true;
          me.setLeaderboardData_(latest_screen_data);
        }, this.countdown_seconds*1000);
        this.showOrHide_();
        for (var r = 0; r < this.airconsole.devices.length; ++r) {
          if (r == from) {
            continue;
          }
          var ready = this.screen_player_ready[r];
          if (ready) {
            ready.style.transition = "width " + this.countdown_seconds +
                "s linear";
            ready.style.width = "100%";
          }
        }
      } else {
        this.showOrHide_();
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
    if (screen_data["force"] &&
        screen_data["generation"] != controller_data["generation"]) {
      controller_data["generation"] = screen_data["generation"];
      this.setLeaderboardData_(controller_data);
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
  var needed = 70 * this.best_of_choices.length;
  if (this.root.offsetHeight > this.root.offsetWidth) {
    this.addClass_(this.root, "airconsole-leaderboard-portrait");
    this.removeClass_(this.root, "airconsole-leaderboard-landscape");
    needed += 256;
  } else {
    this.addClass_(this.root, "airconsole-leaderboard-landscape");
    this.removeClass_(this.root, "airconsole-leaderboard-portrait");
    needed += 80;
  }
  if (this.visible && this.controller_best_of_container) {
    var h = this.controller_container.offsetHeight;
    var scale = "none";
    if (h < needed) {
      var scale = "scale(" + h / needed + ")"
    }
    this.controller_best_of_container.style.transform = scale;
    this.controller_best_of_container.style.webkitTransform = scale;
    if (this.root.offsetHeight <= this.root.offsetWidth) {
      scale = "none";
    }
    this.controller_start.style.transform = scale;
    this.controller_start.style.webkitTransform = scale;

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
  if (this.airconsole.devices.length <= 2) {
    data["best_of"] = 0;
  }
  for (var i = 0; i < this.airconsole.devices.length; ++i) {
    var ready = this.screen_player_ready[i];
    if (ready) {
      ready.style.transition = "none";
      ready.style.width = "0%";
    }
  }
  this.setLeaderboardData_(data);
  this.showOrHide_();
};

AirConsoleLeaderboard.prototype.screenHide_ = function(done) {
  if (this.countdown) {
    window.clearTimeout(this.countdown);
    this.countdown = undefined;
  }
  var data = this.getLeaderboardData_();
  if (done) {
    this.scores = {};
    data["scores"] = this.scores;
    this.showOrHide_();
  }
  if (data["force"]) {
    delete data["force"];
  }
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
    var data = this.getLeaderboardData_(AirConsole.SCREEN);
    for (var i = 1; i < this.airconsole.devices.length; ++i) {
      if (this.scores[i]) {
        pregame = false;
      }
      if (this.scores[i] >= data["best_of"]) {
        pregame = true;
        break;
      }
    }
    if (pregame) {
      data["best_of"] = best_of;
      this.scores = {};
      data["scores"] = this.scores;
      this.setLeaderboardData_(data);
      this.showOrHide_();
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
  if (!this.screen_container) {
    this.screen_winner = document.createElement("div");
    this.screen_winner.className = "airconsole-leaderboard-winner";
    this.root.appendChild(this.screen_winner);
    this.screen_container = document.createElement("div");
    this.screen_container.className = "airconsole-leaderboard-screen-container";
    this.screen_title = document.createElement("div");
    this.screen_title.className = "airconsole-leaderboard-screen-title";
    this.screen_container.appendChild(this.screen_title);
    this.screen_players_container = document.createElement("div");
    this.screen_players_container.className =
        "airconsole-leaderboard-screen-players"
    this.screen_container.appendChild(this.screen_players_container);
    this.screen_player_points = {};
    this.screen_player_points_bg = {};
    this.root.appendChild(this.screen_container);
  }

  var max_width = (this.root.offsetWidth || window.innerWidth) - 400;
  var point_width = 40;
  if (screen_data["best_of"]*point_width > max_width) {
    point_width = (max_width / screen_data["best_of"]) | 0;

  }
  this.screen_players_container.style.width = (366 +
      screen_data["best_of"] * point_width) + "px";
  var winners = [];
  for (var i = 1; i < this.airconsole.devices.length; ++i) {
    var points = this.screen_player_points[i];
    if (!points && this.airconsole.devices[i]) {
      var player = document.createElement("div");
      player.className = "airconsole-leaderboard-player";
      var pic = document.createElement("div");
      pic.className = "airconsole-leaderboard-screen-player-picture";
      pic.style.backgroundImage = "url('" + this.airconsole.getProfilePicture(
          i, 64) + "')";
      player.appendChild(pic)
      var name = document.createElement("div");
      name.className = "airconsole-leaderboard-player-nickname";
      name.innerText = this.airconsole.getNickname(i);
      player.appendChild(name)
      var points_bg = document.createElement("div");
      points_bg = document.createElement("div");
      points_bg.className = "airconsole-leaderboard-points-background";
      player.appendChild(points_bg);
      this.screen_player_points_bg[i] = points_bg;
      points = document.createElement("div");
      points.className = "airconsole-leaderboard-points";
      player.appendChild(points);
      this.screen_player_points[i] = points;
      var ready_container = document.createElement("div");
      ready_container.className = "airconsole-leaderboard-ready";
      var ready = document.createElement("div");
      ready.className = "airconsole-leaderboard-ready-active";
      ready_container.appendChild(ready)
      var ready_text = document.createElement("div");
      ready_text.className = "airconsole-leaderboard-ready-text";
      ready_text.innerText = "Ready";
      ready_container.appendChild(ready_text)
      player.appendChild(ready_container);
      this.screen_player_ready[i] = ready;
      this.screen_players_container.appendChild(player);
    }
    var score = this.scores[i] || 0;
    if (score >= screen_data["best_of"]) {
      winners.push(i);
    }
    if (points) {
      points.style.backgroundSize = point_width + "px";
      this.screen_player_points_bg[i].style.backgroundSize =
          point_width + "px " + point_width + "px";
      var ready = this.screen_player_ready[i];
      if (this.getLeaderboardData_(i)["generation"] ==
          screen_data["generation"]) {
        ready.style.transition = "none";
        ready.style.width = "100%";
      }
    }
  }
  this.screen_title.innerText = "Best of " + screen_data["best_of"];
  if (!screen_data["best_of"]) {
    this.screen_title.innerText = "Multiplayer is more fun!";
  }
  if (!winners.length || this.airconsole.devices.length <= 2) {
    if (this.instructions) {
      this.instructions.style.display = "block";
    }
    this.screen_winner.style.display = "none";
  } else {
    if (this.instructions) {
      this.instructions.style.display = "none";
    }
    var winner_text = "";
    var imgs = [];
    for (var i = 0; i < winners.length; ++i) {
      if (winner_text) {
        winner_text = "We have some winners!";
      } else {
        winner_text = this.airconsole.getNickname(winners[i]) + " wins!";
      }
      imgs.push("<img width=128 height=128 src='" +
                this.airconsole.getProfilePicture(winners[i], 128) + "'>")
    }
    this.screen_winner.innerHTML =
        imgs.join("") + "<br>" +  winner_text + "</div>";
    this.screen_winner.style.display = "block";
  }
  var me = this;
  window.setTimeout(function() {
    for (var i = 1; i < me.airconsole.devices.length; ++i) {
      var points = me.screen_player_points[i];
      if (points) {
        points.style.width = (Math.min(screen_data["best_of"],
                              me.scores[i] || 0) * point_width) + "px";
      }
    }
  }, 0);
};

AirConsoleLeaderboard.prototype.createControllerBestOf = function(best_of) {
  var button = document.createElement("div");
  button.className = "airconsole-leaderboard-controller-best-of-button " +
      "airconsole-leaderboard-button";
  button.innerText = "Best of " + best_of;
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
  if (!this.controller_container) {
    this.controller_container = document.createElement("div");
    this.controller_container.className =
        "airconsole-leaderboard-controller-container";
    this.controller_queue = document.createElement("div");
    this.controller_queue.className =
        "airconsole-leaderboard-controller-queue";
    this.controller_queue.innerHTML =
        "<span class='airconsole-leaderboard-wait'>Waiting</span> for next round";
    this.controller_container.appendChild(this.controller_queue);
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
    this.controller_container.appendChild(this.controller_place);
    this.controller_best_of_container = document.createElement("div");
    this.controller_best_of_container.className =
        "airconsole-leaderboard-controller-best-of";
    this.controller_best_of_container.innerHTML = "Select a mode<br>"
    this.controller_container.appendChild(this.controller_best_of_container);
    this.controller_best_of_buttons = [];
    for (var i = 0; i < this.best_of_choices.length; ++i) {
      this.createControllerBestOf(this.best_of_choices[i]);
    }
    this.controller_start = document.createElement("div");
    this.controller_start.className =
        "airconsole-leaderboard-controller-start " +
        "airconsole-leaderboard-button";
    this.controller_start.innerText = "Ready";
    this.controller_start.addEventListener("touchstart", function() {
      var controller_data = me.getLeaderboardData_();
      var screen_data = me.getLeaderboardData_(AirConsole.SCREEN);
      controller_data["generation"] = screen_data["generation"];
      me.setLeaderboardData_(controller_data);
      me.showOrHide_();
    });
    this.controller_container.appendChild(this.controller_start);
    this.root.appendChild(this.controller_container);
  }
  this.controller_place.style.display = "none";
  this.controller_best_of_container.style.display = "none";
  if (screen_data["visible"]) {
    this.controller_queue.style.display = "none";
    this.controller_start.style.display = "block";
    if (screen_data["generation"] != controller_data["generation"]) {
      this.removeClass_(this.controller_start,
                        "airconsole-leaderboard-button-active");
    } else {
      this.addClass_(this.controller_start,
                     "airconsole-leaderboard-button-active");
      this.controller_queue.style.display = "none";
    }
    var score_rank = [];
    var highest_score = 0;
    for (var i = 1; i < this.airconsole.devices.length; ++i) {
      if (this.airconsole.devices[i]) {
        var score = screen_data.scores[i] || 0;
        highest_score = Math.max(score, highest_score);
        score_rank.push(score)
      }
    }
    score_rank.sort(function(a, b){return b-a});
    if (screen_data["best_of"] == 0) {
      // nothing
    } else if (highest_score && highest_score < screen_data["best_of"]) {
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
            "airconsole-leaderboard-button-active");
      } else {
        this.removeClass_(button,
             "airconsole-leaderboard-button-active");
      }
    }
  } else {
    this.controller_start.style.display = "none";
    this.controller_queue.style.display = "block";
  }
  if (this.instructions) {
    this.controller_container.style.top = this.instructions.offsetHeight + "px";
  }
  window.setTimeout(function() {
    me.checkOrientation_();
  })
};