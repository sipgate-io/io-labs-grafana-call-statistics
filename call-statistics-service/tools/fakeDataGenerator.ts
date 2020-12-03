import Database from "../src/Database";

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

const enum Day {
  Sunday,
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
}

const teams = ["Sales Example", "Marketing Example", "Management Example"];

const distrib = (secondsOfDay: number, meanValue: number, sigma: number) => {
  const t = secondsOfDay / (24 * 60 * 60);
  const u = meanValue / (24 * 60 * 60);
  return (
    (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-0.5 * Math.pow((t - u) / sigma, 2))
  );
};

const callProbability = (time: Date) => {
  if (time.getDay() == Day.Sunday) return 0.05;
  if (time.getDay() == Day.Saturday) return 0.2;

  if (time.getHours() < 6 || time.getHours() > 21) return 0.1;

  const secondsOfDay =
    time.getHours() * 60 * 60 + time.getMinutes() * 60 + time.getSeconds();
  const meanValue = 13 * 60 * 60;
  return distrib(secondsOfDay, meanValue, 0.3);
};
const answerProbability = (time: Date) => {
  if (time.getDay() == Day.Sunday || time.getDay() == Day.Sunday) return 0;
  return 0.9;
};
const directionInProbability = (time: Date) => {
  if (time.getDay() == Day.Sunday || time.getDay() == Day.Sunday) return 1;
  return 0.9;
};
const groupProbability = (time: Date) => {
  return 0.3;
};
const activeCallProbability = (time: Date) => {
  return 0.05;
};
const voicemailProbability = (time: Date) => {
  if (time.getDay() == Day.Sunday || time.getDay() == Day.Sunday) return 1;
  return 0.1;
};

const minAnswerTime = (time: Date) => {
  if (time.getDay() == Day.Sunday || time.getDay() == Day.Saturday) return 0;

  return 2000;
};
const maxAnswerTime = (time: Date) => {
  if (time.getDay() == Day.Sunday || time.getDay() == Day.Saturday) return 0;

  const secondsOfDay =
    time.getHours() * 60 * 60 + time.getMinutes() * 60 + time.getSeconds();
  const meanValue = 13 * 60 * 60;
  return distrib(secondsOfDay, meanValue, 0.3) * 20000;
};
const minHangupTime = (time: Date) => {
  return 12000;
};
const maxHangupTime = (time: Date) => {
  return 100000;
};

async function generateFakeData(
  db: Database,
  from: Date,
  to: Date,
  stepMinutes: number = 60
) {
  await insertFakeGroups(db);

  for (
    let d = from.getTime();
    d <= to.getTime();
    d += stepMinutes * 1000 * 60
  ) {
    if (Math.random() < callProbability(new Date(d))) {
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
  const voicemail = Math.random() < voicemailProbability(time);
  let direction =
    voicemail || Math.random() > directionInProbability(time) ? "in" : "out";
  const masterSipId = [Math.floor(Math.random() * 100000).toString()];
  const userExtension = "w" + Math.floor(Math.random() * 10);
  const from = "+49" + Math.floor(Math.random() * 10000000000).toString();
  const to = "+49" + Math.floor(Math.random() * 10000000000).toString();
  const answeringNumber =
    "+49" + Math.floor(Math.random() * 10000000000).toString();
  let hangupCause = hangupCausesWithoutAnswer[Math.floor(Math.random() * 6)];
  let groupExtension = null;
  if (Math.random() < groupProbability(time)) {
    const groupCount = Object.keys(groups).length;
    const randGroupId = Math.floor(Math.random() * groupCount);
    groupExtension = Object.keys(groups)[randGroupId];
  }

  if (direction === "in" && Math.random() > 0.7) {
    await db.query("INSERT INTO teams_numbers VALUES(?,?)", [
      Math.floor(Math.random() * teams.length) + 1,
      to,
    ]);
  }

  if (direction === "out" && Math.random() > 0.7) {
    await db.query("INSERT INTO teams_numbers VALUES(?,?)", [
      Math.floor(Math.random() * teams.length) + 1,
      from,
    ]);
  }

  await db.query(
    "INSERT INTO calls VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, false)",
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

  const callAnswered = Math.random() < answerProbability(time);

  if (callAnswered) {
    const answerTime = new Date(
      time.getTime() +
        Math.abs(minAnswerTime(time) + Math.random() * maxAnswerTime(time))
    );

    (async () => {
      if (masterSipId) {
        await db.query(
          "UPDATE calls SET answered_at=?, mastersip_id=?, user_extension=?, answering_number=? WHERE call_id=?",
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
    time.getTime() +
      Math.abs(minHangupTime(time) + Math.random() * maxHangupTime(time))
  );

  if (Math.random() < activeCallProbability(time) && !voicemail) {
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
  await db.query("DELETE FROM calls WHERE fake = true");
  console.log("deleted all fake calls");
  await db.query("DELETE FROM groups WHERE extension LIKE 'g00%'");
  console.log("deleted all fake groups");
}

async function run() {
  const db: Database = new Database(db_host, db_user, db_password, db_database);
  await deleteFakeData(db);
  await generateFakeData(db, new Date("11/10/2020"), new Date(), 5);
  await db.end();
}

run().catch(console.error);
