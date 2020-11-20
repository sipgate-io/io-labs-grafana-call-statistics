import Database from "../src/database";
import { promisify } from "util";

// https://developer.sipgate.io/push-api/api-reference/#onhangup
const hangupCauseWithAnswer = "normalClearing";

const db_host = process.env.MYSQL_HOST;
const db_user = process.env.MYSQL_USER;
const db_password = process.env.MYSQL_PASSWORD;
const db_database = process.env.MYSQL_DATABASE;

if (!db_host || !db_user || !db_password || !db_database) {
  console.log(
    "Please provide the environment variables MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD and MYSQL_DATABASE"
  );
  process.exit(1);
}

const hangupCausesWithoutAnswer = [
  "cancel",
  "busy",
  "noAnswer",
  "congestion",
  "notFound",
  "forwarded",
];

const groups = {
  g000: "Sales",
  g001: "Hotline",
  g002: "Marketing",
};

const teams = ["Sales Example", "Marketing Example", "Management Example"];

const callProbability = 0.7;
const answerProbability = 0.9;
const directionInProbability = 0.9;
const groupProbability = 0.3;
const activeCallProbability = 0.001;
const voicemailProbability = 0.1;

const minAnswerTime = 2000;
const maxAnswerTime = 8000;
const minHangupTime = 12000;
const maxHangupTime = 30000;

async function generateFakeData(
  db: any,
  from: Date,
  to: Date,
  stepMinutes: number = 60
) {
  await insertFakeGroups(db);

  for (
    var d = from.getTime();
    d <= to.getTime();
    d += stepMinutes * 1000 * 60
  ) {
    if (Math.random() < callProbability) {
      await insertFakeData(db, new Date(d));
    }
  }
  console.log(`inserted fake data:\nfrom\t${from}\nto\t${to}`);
}

async function insertFakeGroups(db: any) {
  for (const [groupExtension, groupAlias] of Object.entries(groups)) {
    await db.query("INSERT INTO groups VALUES(?, ?)", [
      groupExtension,
      groupAlias,
    ]);
  }
}

async function insertFakeData(db: any, time: Date) {
  const callId = Math.floor(Math.random() * 1000000000000).toString();
  const start = time;
  const voicemail = Math.random() < voicemailProbability;
  let direction = voicemail
    ? "in"
    : Math.random() > directionInProbability
    ? "in"
    : "out";
  const masterSipId = [Math.floor(Math.random() * 100000).toString()];
  const userExtension = "w" + Math.floor(Math.random() * 10);
  const from = "+49" + Math.floor(Math.random() * 10000000000).toString();
  const to = "+49" + Math.floor(Math.random() * 10000000000).toString();
  const answeringNumber =
    "+49" + Math.floor(Math.random() * 10000000000).toString();
  let hangupCause = hangupCausesWithoutAnswer[Math.floor(Math.random() * 6)];
  let groupExtension = null;
  if (Math.random() < groupProbability) {
    const groupCount = Object.keys(groups).length;
    const randGroupId = Math.floor(Math.random() * groupCount);
    groupExtension = Object.keys(groups)[randGroupId];
  }

  if (direction === "in" && Math.random() > 0.7) {
    await db.query("INSERT INTO teams_numbers VALUES(?,?)", [
      Math.floor(Math.random() * teams.length),
      to,
    ]);
  }

  if (direction === "out" && Math.random() > 0.7) {
    await db.query("INSERT INTO teams_numbers VALUES(?,?)", [
      Math.floor(Math.random() * teams.length),
      from,
    ]);
  }

  await db.query(
    "INSERT INTO calls VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)",
    [
      callId,
      start,
      null,
      null,
      direction,
      masterSipId.length == 1 ? masterSipId[0] : null,
      userExtension,
      from,
      to,
      null,
      null,
      groupExtension,
      voicemail,
    ]
  );
  console.log("inserted call " + callId);

  // TODO: enter Group in some cases

  const callAnswered = Math.random() < answerProbability;

  if (callAnswered) {
    const answerTime = new Date(
      time.getTime() + minAnswerTime + Math.random() * maxAnswerTime
    );

    (async () => {
      if (masterSipId) {
        await db.query(
          "UPDATE calls SET answered_at=?, callee_mastersip_id=?, callee_extension=?, answering_number=? WHERE call_id=?",
          [answerTime, masterSipId, userExtension, answeringNumber, callId]
        );
      } else {
        await db.query(
          "UPDATE calls SET answered_at=?, answering_number=? WHERE call_id=?",
          [answerTime, answeringNumber, callId]
        );
      }
    })();
    hangupCause = hangupCauseWithAnswer;
    console.log("answered call " + callId);
  }

  let endTime = new Date(
    time.getTime() + minHangupTime + Math.random() * maxHangupTime
  );

  if (Math.random() < activeCallProbability && !voicemail) {
    endTime = null;
    hangupCause = null;
  }

  (async () =>
    await db.query("UPDATE calls SET end=?, hangup_cause=? WHERE call_id=?", [
      endTime,
      hangupCause,
      callId,
    ]))();
  console.log("hung up call " + callId);
}

async function deleteFakeData(db: any) {
  try {
    await db.query("DELETE FROM calls WHERE fake = true");
    console.log("deleted all fake calls");
    await db.query("DELETE FROM groups WHERE extension LIKE 'g00%'");
    console.log("deleted all fake groups");
  } catch (e) {
    console.error(e);
  }
}

async function run() {
  const db: Database = new Database(db_host, db_user, db_password, db_database);
  await deleteFakeData(db);
  await generateFakeData(db, new Date("11/10/2020"), new Date(), 5);
  await db.end();
}

run();
