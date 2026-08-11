let state = Alpine.reactive({
    names: function(n) {
        let N = ["Mr/Mrs X", "Alex", "Blake", "Cameron", "Dakota", "Emery", "Finley", "Gray", "Harper", "Indigo", "Jordan", "Kai", "Logan", "Morgan", "Nova", "Oakley", "Parker", "Quinn", "Riley", "Sage", "Taylor", "Urban", "Vale", "Winter", "Xander", "York", "Zephyr"];
        list = N.slice(0,n);
        for (let i=27; i<n; i++) {
            list[i] = i.toString();
        }
        for (let i=1; i<n; i++) {
            list[i] = "Detective " + list[i];
        }
        return list;
    },
    stops: [],
    phase: 'config', 
    teams: 4,
    team: undefined,
    mister_x_reveal_time: 10,
    mister_x_win_time: 45,
    current_position: "Start",
    pos_logs_raw: [],
    pos_logs: [],
    message_logs: [],
    game_result: ""
});

let config_set = false;
let local_start_time = Date.now();
const id = window.webxdc.selfAddr;
let admin = 0;

function sendConfig() {
    state.stops = document.getElementById("stops").value.split("\n");
    state.stops.sort();
    state.phase = "lobby";
    local_start_time = Date.now();
    window.webxdc.sendUpdate({ payload: {
        type: "config",
        payload: {
            stops: state.stops,
            teams: state.teams,
            mister_x_reveal_time: state.mister_x_reveal_time,
            mister_x_win_time: state.mister_x_win_time,
            admin: id,
            start_time: local_start_time
        }
    } }, '');
    //setInterval(sendTime, 10000);
}

function receiveConfig(config) {
    if (config_set) { return; }
    config_set = true;
    state.stops = config.stops;
    state.teams = config.teams;
    state.mister_x_reveal_time = config.mister_x_reveal_time;
    state.mister_x_win_time = config.mister_x_win_time;
    state.detective_reveal_delay = config.detective_reveal_delay;
    state.phase = "lobby";
    admin = config.admin;
    local_start_time = config.start_time;
}

function gameTime() {
    return Date.now() - local_start_time;
}

function printTime(time_passed) {
    let minutes = Math.floor(time_passed/60000).toString();
    let seconds = Math.floor((time_passed % 60000) / 1000).toString();
    if (seconds.length == 1) { seconds = "0"+seconds; }
    return minutes + ":" + seconds;
}

function sendTime() {
    window.webxdc.sendUpdate({ payload: {
        type: "time",
        payload: {
            id : id,
            time_passed : gameTime()
        }
    } }, '');
}

function receiveTime(timeUpdate) {
    if (timeUpdate.id != admin) { return; }
    let calculated_start_time = Date.now() - timeUpdate.time_passed;
    if (true || calculated_start_time < local_start_time) {
        local_start_time = calculated_start_time;
    }  
    rewriteTime();
}

function rewriteTime() {
    let timer = document.getElementById("timer");
    let seconds = Math.floor((gameTime() % 60000) / 1000);
    let time = printTime(gameTime()) 
    if (seconds == 0) {
        rewriteRevealTime()
        add_reveals(state.pos_logs)
        check_x_won()
    }
    timer.innerHTML = printTime(gameTime()) + " / " + state.mister_x_win_time + ":00";}

function rewriteRevealTime() {
    let rvtimer = document.getElementById("rvtimer")
    let rvtime = (Math.floor(gameTime() / (state.mister_x_reveal_time*60000))+1) * state.mister_x_reveal_time;
    rvtimer.innerHTML = rvtime + ":00"
}

function sendPosition(position) {
    state.current_position = position
    window.webxdc.sendUpdate({ payload: {
        type: "position",
        payload: {
            time_passed: gameTime(), 
            team: state.team, 
            position: position
        }
    } }, '');
}

function receivePosition(positionUpdate) {
    state.pos_logs.push(positionUpdate);
    state.pos_logs.sort((a, b) => b.time_passed - a.time_passed);
    add_reveals(state.pos_logs)
    check_x_caught(state.pos_logs)
}

function printPosition(pos) {
    if (pos.team != "Mr/Mrs X") { return pos.position }
    if (state.team == "Mr/Mrs X") {
        if (pos.reveal) { return pos.position + " (revealed)"}
        else { return pos.position + " (hidden)"}
    }
    else {
        if (pos.reveal) { return pos.position }
        else { return "Unknown" }
    }
}

function add_reveals(pos_logs) {
    var X_pos_logs = pos_logs.filter((ev) => ev.team == "Mr/Mrs X")
    
    var reveal_time = state.mister_x_reveal_time * 60000
    var epoch
    var next_epoch = Math.ceil(gameTime() / reveal_time)


    for (var i=0; i < X_pos_logs.length; i++) { 
        // Wir gehen die Zeit rückwärts wegen der Sortierung

        let pos = X_pos_logs[i]
        epoch = Math.ceil(pos.time_passed / reveal_time)
        
        let reveal = epoch < next_epoch 
        pos.reveal = reveal 
        pos.debug = epoch + " " + next_epoch
        next_epoch = epoch
    }

    return pos_logs
}

function check_x_caught(pos_logs) {
    var x_pos
    var detective_pos = {}
    for (var i = pos_logs.length - 1; i >= 0; i--) {
        p = pos_logs[i]
        p.debug = JSON.stringify(detective_pos)
        if (p.team == "Mr/Mrs X") { 
            x_pos = p.position 
        }
        else { 
            detective_pos[p.team] = p.position
        }
        console.log(state.team, x_pos, detective_pos)
        for (t in detective_pos) {
            if (detective_pos[t] == x_pos) { 
                state.phase = "end";
                state.game_result = "Mr/Mrs X was caught by " + t + " at " + x_pos + "."
                return 
            }
        }
    }
    if (state.phase == "end" && state.game_result[9] == "w") {
        state.phase = "game"
    }
}

function check_x_won() {
    if (state.game_result != "") { return }
    let minutes = Math.floor(gameTime()/60000)
    console.log(minutes, state.mister_x_win_time) 
    if (minutes >= state.mister_x_win_time) {
        state.phase = "end"
        state.game_result = "Mr/Mrs X successfully escaped the detectives for " + state.mister_x_win_time + " minutes."
    }
}

function sendMessage(message) {
    window.webxdc.sendUpdate({ payload: {
        type: "message",
        payload: {
            origin: state.team,
            message : message,
            time_passed : gameTime()
        }
    } }, '');
}

function receiveMessage(messageUpdate) {
    state.message_logs.push(messageUpdate);
    state.message_logs.sort((a, b) => b.time_passed - a.time_passed)
}

function receiveUpdate(update) {
    switch(update.payload.type) {
        case "config":
            receiveConfig(update.payload.payload);
            break;
        case "time":
            receiveTime(update.payload.payload);
            break;
        case "position":
            receivePosition(update.payload.payload);
            break;
        case "message":
            receiveMessage(update.payload.payload);
            break;    
        }
}

setInterval(rewriteTime, 1000);

window.webxdc.setUpdateListener(receiveUpdate, 0);