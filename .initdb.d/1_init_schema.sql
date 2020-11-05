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
    fake BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (group_extension) REFERENCES groups(extension) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE forwarded_calls (
    from_call_id VARCHAR(255),
    to_call_id VARCHAR(255),
    PRIMARY KEY (from_call_id, to_call_id)
);
