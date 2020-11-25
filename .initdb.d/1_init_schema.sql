USE call_statistics;

CREATE TABLE groups (
    extension VARCHAR(255) PRIMARY KEY,
    alias VARCHAR(255)
);

CREATE TABLE calls (
    call_id VARCHAR(255) PRIMARY KEY,
    start DATETIME NOT NULL,
    end DATETIME,
    answered_at DATETIME,
    direction ENUM('in','out') NOT NULL,
    callee_mastersip_id VARCHAR(255),
    callee_extension VARCHAR(255),
    caller_number VARCHAR(255) NOT NULL,
    callee_number VARCHAR(255) NOT NULL,
    answering_number VARCHAR(255),
    hangup_cause ENUM('normalClearing', 'busy', 'cancel', 'noAnswer', 'congestion', 'notFound', 'forwarded'),
    group_extension VARCHAR(255) NULL,
    voicemail BOOLEAN NOT NULL DEFAULT false,
    fake BOOLEAN NOT NULL DEFAULT false,
    crashed BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY (group_extension) REFERENCES groups(extension) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE authentication_params (
    token_type ENUM('access', 'refresh') PRIMARY KEY,
    token_value TEXT NOT NULL
);


CREATE TABLE teams (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE teams_numbers (
    team_id INTEGER NOT NULL,
    number VARCHAR(255) NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id)
);
