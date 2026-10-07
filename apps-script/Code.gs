/******************************************************
 * WCC 2026 — REGISTRATION + LIVE CHECK-IN API
 *
 * IMPORTANT:
 * - Existing registration POST behavior is preserved.
 * - Registration data remains in the existing sheet.
 * - Check-ins are stored in a separate "Checkins" sheet.
 * - Registration IDs / check-in codes are forced to TEXT.
 * - Check-in/dashboard/lookup require admin login.
 * - Registration submission remains public so the
 *   existing registration frontend keeps working.
 ******************************************************/

const SPREADSHEET_ID =
  "1r1iTiHJ6SYfqYmSxOSlbX0FpMH4XuWgVJEQpYCVyEjc";

const SHEET_NAME = "";

/*
 * Admin password requested for the WCC check-in app.
 *
 * The frontend should NEVER contain this password.
 * Login is checked here in Apps Script.
 */
const ADMIN_PASSWORD = "Truelightcc223";

/*
 * Existing registration columns.
 * Keep these exactly as they are because the
 * registration frontend already uses these fields.
 */
const HEADERS = [
  "registrationId",
  "checkInCode",
  "submittedAt",
  "name",
  "email",
  "phone",
  "attendedWccBefore",
  "expectations",
  "isTrueLighter",
  "isWorker",
  "unit",
  "church",
  "locationScope",
  "needsAccommodation",
  "isPastor",
  "pastorChurch",
];

const CHECKINS_SHEET_NAME = "Checkins";

const CHECKIN_HEADERS = [
  "registrationId",
  "checkInCode",
  "name",
  "session",
  "timestamp",
];

const SESSIONS = [
  "Wednesday Evening",
  "Thursday Morning",
  "Thursday Evening",
  "Friday Morning",
  "Friday Evening",
  "Saturday Morning",
  "Sunday Morning",
];


/******************************************************
 * GET
 ******************************************************/

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || "status";

    if (action === "status") {
      return jsonResponse({
        ok: true,
        service: "wcc-registration-checkin",
        message: "WCC registration and check-in endpoint is running.",
      });
    }

    /*
     * Public endpoint used by the existing frontend to
     * confirm the service is alive.
     */
    if (action === "sessions") {
      return jsonResponse({
        ok: true,
        sessions: SESSIONS,
      });
    }

    /*
     * Everything below this point is protected.
     */
    if (!isValidToken(params.token)) {
      return unauthorizedResponse();
    }

    if (action === "lookup") {
      return jsonResponse(
        lookupMembers(params.q || "")
      );
    }

    if (action === "history") {
      return jsonResponse(
        getMemberHistory(
          params.registrationId ||
          params.checkInCode ||
          ""
        )
      );
    }

    if (action === "dashboard") {
      return jsonResponse(
        getDashboard()
      );
    }

    return jsonResponse({
      ok: false,
      error: "Unknown action.",
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });
  }
}


/******************************************************
 * POST
 ******************************************************/

function doPost(e) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No request payload was received.");
    }

    const payload =
      JSON.parse(e.postData.contents);

    /*
     * Support the login action names used by both the
     * current and earlier WCC frontend builds.
     *
     * Some builds send:
     *   action: "login"
     * Others may send:
     *   action: "adminLogin"
     *   action: "authenticate"
     *
     * A password-only request is also treated as a login
     * request when no action is supplied.
     */
    const rawAction =
      payload.action === undefined ||
      payload.action === null
        ? ""
        : String(payload.action).trim();

    const normalizedAction =
      rawAction.toLowerCase();

    const isLoginRequest =
      normalizedAction === "login" ||
      normalizedAction === "adminlogin" ||
      normalizedAction === "authenticate" ||
      normalizedAction === "admin_login" ||
      (
        !rawAction &&
        payload.password !== undefined
      );

    const action =
      isLoginRequest
        ? "login"
        : (rawAction || "registration");


    /**************************************************
     * ADMIN LOGIN
     **************************************************/

    if (action === "login") {
      return jsonResponse(
        adminLogin(
          payload.password || ""
        )
      );
    }


    /**************************************************
     * EXISTING PUBLIC REGISTRATION
     *
     * DO NOT REQUIRE ADMIN AUTH HERE.
     * This keeps the registration frontend working.
     **************************************************/

    if (action === "registration") {

      lock.waitLock(30000);
      lockAcquired = true;

      const sheet =
        getRegistrationSheet();

      ensureHeaders(sheet);

      /*
       * IMPORTANT:
       * Registration IDs and check-in codes are written
       * as TEXT so Google Sheets does not turn:
       *
       * 00123 -> 123
       *
       * or otherwise alter the identifier.
       */
      prepareTextColumns(sheet);

      const row = HEADERS.map(
        function(header) {
          return normalizeCell(
            payload[header]
          );
        }
      );

      const nextRow =
        sheet.getLastRow() + 1;

      sheet
        .getRange(
          nextRow,
          1,
          1,
          HEADERS.length
        )
        .setNumberFormat("@")
        .setValues([row]);

      return jsonResponse({
        ok: true,
        sheet: sheet.getName(),
        registrationId:
          normalizeCell(payload.registrationId),
        checkInCode:
          normalizeCell(
            payload.checkInCode ||
            payload.registrationId ||
            ""
          ),
      });
    }


    /**************************************************
     * CHECK-IN
     **************************************************/

    if (action === "checkin") {

      if (!isValidToken(payload.token)) {
        return unauthorizedResponse();
      }

      lock.waitLock(30000);
      lockAcquired = true;

      return jsonResponse(
        processCheckIn(payload)
      );
    }


    return jsonResponse({
      ok: false,
      error: "Unknown POST action.",
    });

  } catch (error) {

    console.error(error);

    return jsonResponse({
      ok: false,
      error: error.message || String(error),
    });

  } finally {

    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}


/******************************************************
 * ADMIN LOGIN
 *
 * Returns a temporary token.
 *
 * The password itself is never returned to the client.
 ******************************************************/

function adminLogin(password) {

  if (
    String(password || "") !==
    ADMIN_PASSWORD
  ) {
    return {
      ok: false,
      authenticated: false,
      error: "Incorrect admin password.",
    };
  }

  /*
   * Create a random temporary token.
   * CacheService keeps it server-side.
   *
   * Token expires after 6 hours.
   */
  const token =
    Utilities.getUuid();

  CacheService
    .getScriptCache()
    .put(
      "admin_" + token,
      "authorized",
      21600
    );

  return {
    ok: true,
    authenticated: true,
    token: token,
    expiresInSeconds: 21600,
  };
}


/******************************************************
 * TOKEN VALIDATION
 ******************************************************/

function isValidToken(token) {

  if (!token) {
    return false;
  }

  const value =
    CacheService
      .getScriptCache()
      .get(
        "admin_" + String(token)
      );

  return value === "authorized";
}


/******************************************************
 * REGISTRATION SHEET
 ******************************************************/

function getRegistrationSheet() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const sheets =
    spreadsheet.getSheets();

  if (!sheets.length) {
    throw new Error(
      "This spreadsheet does not contain a worksheet tab."
    );
  }

  if (SHEET_NAME.trim()) {

    const namedSheet =
      spreadsheet.getSheetByName(
        SHEET_NAME.trim()
      );

    if (!namedSheet) {
      throw new Error(
        'Worksheet tab "' +
        SHEET_NAME +
        '" was not found.'
      );
    }

    return namedSheet;
  }

  return sheets[0];
}


/******************************************************
 * CHECKINS SHEET
 ******************************************************/

function getCheckinsSheet() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  let sheet =
    spreadsheet.getSheetByName(
      CHECKINS_SHEET_NAME
    );

  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        CHECKINS_SHEET_NAME
      );

    sheet
      .getRange(
        1,
        1,
        1,
        CHECKIN_HEADERS.length
      )
      .setNumberFormat("@")
      .setValues([
        CHECKIN_HEADERS
      ]);

    sheet.setFrozenRows(1);

  } else {

    ensureCheckinHeaders(sheet);
  }

  /*
   * Keep identifiers as text.
   */
  sheet
    .getRange(
      1,
      1,
      Math.max(sheet.getMaxRows(), 1),
      2
    )
    .setNumberFormat("@");

  return sheet;
}


/******************************************************
 * ENSURE CHECK-IN HEADERS
 ******************************************************/

function ensureCheckinHeaders(sheet) {

  const existing =
    sheet
      .getRange(
        1,
        1,
        1,
        CHECKIN_HEADERS.length
      )
      .getDisplayValues()[0]
      .map(
        function(value) {
          return String(value).trim();
        }
      );

  const matches =
    CHECKIN_HEADERS.every(
      function(header, index) {
        return existing[index] === header;
      }
    );

  if (!matches) {
    sheet
      .getRange(
        1,
        1,
        1,
        CHECKIN_HEADERS.length
      )
      .setNumberFormat("@")
      .setValues([
        CHECKIN_HEADERS
      ]);
  }
}


/******************************************************
 * ENSURE REGISTRATION HEADERS
 ******************************************************/

function ensureHeaders(sheet) {

  const existingHeaders =
    sheet
      .getRange(
        1,
        1,
        1,
        HEADERS.length
      )
      .getDisplayValues()[0]
      .map(
        function(value) {
          return String(value).trim();
        }
      );

  const headersMatch =
    HEADERS.every(
      function(header, index) {
        return existingHeaders[index] === header;
      }
    );

  if (!headersMatch) {

    sheet
      .getRange(
        1,
        1,
        1,
        HEADERS.length
      )
      .setValues([
        HEADERS
      ]);
  }

  prepareTextColumns(sheet);
}


/******************************************************
 * PROTECT IDENTIFIER COLUMNS
 ******************************************************/

function prepareTextColumns(sheet) {

  /*
   * Column 1 = registrationId
   * Column 2 = checkInCode
   *
   * Applying TEXT formatting to these columns prevents
   * Google Sheets from changing numeric-looking IDs.
   */
  sheet
    .getRange(
      1,
      1,
      Math.max(sheet.getMaxRows(), 1),
      2
    )
    .setNumberFormat("@");
}


/******************************************************
 * LOOKUP
 ******************************************************/

function lookupMembers(query) {

  query =
    String(query || "")
      .trim()
      .toLowerCase();

  if (!query) {
    return {
      ok: true,
      members: [],
    };
  }

  const sheet =
    getRegistrationSheet();

  ensureHeaders(sheet);

  /*
   * getDisplayValues() is intentional.
   *
   * It reads exactly what Google Sheets displays,
   * avoiding numeric conversion problems.
   */
  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  if (values.length < 2) {

    return {
      ok: true,
      members: [],
    };
  }

  const headers =
    values[0].map(
      function(value) {
        return String(value).trim();
      }
    );

  const registrationIdIndex =
    headers.indexOf(
      "registrationId"
    );

  const checkInCodeIndex =
    headers.indexOf(
      "checkInCode"
    );

  const nameIndex =
    headers.indexOf(
      "name"
    );

  if (
    registrationIdIndex === -1 ||
    checkInCodeIndex === -1 ||
    nameIndex === -1
  ) {
    throw new Error(
      "Required registration columns were not found."
    );
  }

  const members = [];

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const registrationId =
      String(
        values[i][registrationIdIndex] || ""
      ).trim();

    const checkInCode =
      String(
        values[i][checkInCodeIndex] || ""
      ).trim();

    const name =
      String(
        values[i][nameIndex] || ""
      ).trim();

    if (
      !registrationId &&
      !checkInCode &&
      !name
    ) {
      continue;
    }

    const matchesId =
      registrationId
        .toLowerCase()
        .includes(query);

    const matchesCode =
      checkInCode
        .toLowerCase()
        .includes(query);

    const matchesName =
      name
        .toLowerCase()
        .includes(query);

    if (
      matchesId ||
      matchesCode ||
      matchesName
    ) {

      members.push({
        registrationId:
          registrationId,

        checkInCode:
          checkInCode,

        name:
          name,
      });
    }

    if (members.length >= 20) {
      break;
    }
  }

  return {
    ok: true,
    members: members,
  };
}


/******************************************************
 * CHECK-IN
 ******************************************************/

function processCheckIn(payload) {

  const registrationId =
    String(
      payload.registrationId || ""
    ).trim();

  const checkInCode =
    String(
      payload.checkInCode || ""
    ).trim();

  const session =
    String(
      payload.session || ""
    ).trim();

  if (
    !registrationId &&
    !checkInCode
  ) {
    return {
      ok: false,
      status: "invalid",
      error:
        "Registration ID or check-in code is required.",
    };
  }

  if (!session) {
    return {
      ok: false,
      status: "invalid",
      error:
        "Check-in session is required.",
    };
  }

  if (!SESSIONS.includes(session)) {
    return {
      ok: false,
      status: "invalid",
      error:
        "Invalid WCC check-in session.",
    };
  }

  const member =
    findRegisteredMember(
      registrationId,
      checkInCode
    );

  if (!member) {
    return {
      ok: false,
      status: "not_found",
      error:
        "This person is not registered.",
    };
  }


  /****************************************************
   * DUPLICATE CHECK
   ****************************************************/

  const checkinsSheet =
    getCheckinsSheet();

  const values =
    checkinsSheet
      .getDataRange()
      .getDisplayValues();

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const existingRegistrationId =
      String(
        values[i][0] || ""
      ).trim();

    const existingCode =
      String(
        values[i][1] || ""
      ).trim();

    const existingSession =
      String(
        values[i][3] || ""
      ).trim();

    const samePerson =
      (
        registrationId &&
        existingRegistrationId ===
        registrationId
      ) ||
      (
        checkInCode &&
        existingCode ===
        checkInCode
      );

    if (
      samePerson &&
      existingSession ===
      session
    ) {

      return {
        ok: true,
        status: "already_checked_in",

        member: member,

        session: session,

        timestamp:
          values[i][4],
      };
    }
  }


  /****************************************************
   * SAVE CHECK-IN
   ****************************************************/

  const timestamp =
    new Date();

  const nextRow =
    checkinsSheet.getLastRow() + 1;

  checkinsSheet
    .getRange(
      nextRow,
      1,
      1,
      CHECKIN_HEADERS.length
    )
    .setNumberFormat("@")
    .setValues([
      [
        member.registrationId,
        member.checkInCode,
        member.name,
        session,
        timestamp,
      ],
    ]);

  /*
   * Restore a useful date format for timestamp.
   */
  checkinsSheet
    .getRange(
      nextRow,
      5
    )
    .setNumberFormat(
      "dd/MM/yyyy HH:mm:ss"
    );

  return {
    ok: true,
    status: "checked_in",

    member: member,

    session: session,

    timestamp: timestamp,
  };
}


/******************************************************
 * FIND REGISTERED MEMBER
 ******************************************************/

function findRegisteredMember(
  registrationId,
  checkInCode
) {

  const sheet =
    getRegistrationSheet();

  ensureHeaders(sheet);

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  if (values.length < 2) {
    return null;
  }

  const headers =
    values[0].map(
      function(value) {
        return String(value).trim();
      }
    );

  const registrationIdIndex =
    headers.indexOf(
      "registrationId"
    );

  const checkInCodeIndex =
    headers.indexOf(
      "checkInCode"
    );

  const nameIndex =
    headers.indexOf(
      "name"
    );

  if (
    registrationIdIndex === -1 ||
    checkInCodeIndex === -1 ||
    nameIndex === -1
  ) {
    throw new Error(
      "Required registration columns were not found."
    );
  }

  const wantedId =
    String(
      registrationId || ""
    ).trim();

  const wantedCode =
    String(
      checkInCode || ""
    ).trim();

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const rowRegistrationId =
      String(
        values[i][registrationIdIndex] || ""
      ).trim();

    const rowCheckInCode =
      String(
        values[i][checkInCodeIndex] || ""
      ).trim();

    if (
      (
        wantedId &&
        rowRegistrationId === wantedId
      ) ||
      (
        wantedCode &&
        rowCheckInCode === wantedCode
      )
    ) {

      return {
        registrationId:
          rowRegistrationId,

        checkInCode:
          rowCheckInCode,

        name:
          String(
            values[i][nameIndex] || ""
          ).trim(),
      };
    }
  }

  return null;
}


/******************************************************
 * MEMBER HISTORY
 ******************************************************/

function getMemberHistory(identifier) {

  identifier =
    String(identifier || "")
      .trim();

  if (!identifier) {
    return {
      ok: false,
      error:
        "Registration ID is required.",
    };
  }

  const member =
    findRegisteredMember(
      identifier,
      identifier
    );

  if (!member) {
    return {
      ok: false,
      status: "not_found",
      error:
        "Registration not found.",
    };
  }

  const sheet =
    getCheckinsSheet();

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  const history = [];

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const rowRegistrationId =
      String(
        values[i][0] || ""
      ).trim();

    const rowCode =
      String(
        values[i][1] || ""
      ).trim();

    if (
      rowRegistrationId ===
        member.registrationId ||
      rowCode ===
        member.checkInCode
    ) {

      history.push({
        registrationId:
          rowRegistrationId,

        checkInCode:
          rowCode,

        name:
          values[i][2],

        session:
          values[i][3],

        timestamp:
          values[i][4],
      });
    }
  }

  return {
    ok: true,
    member: member,
    sessions: history,
  };
}


/******************************************************
 * DASHBOARD
 ******************************************************/

function getDashboard() {

  const sheet =
    getCheckinsSheet();

  const values =
    sheet
      .getDataRange()
      .getDisplayValues();

  const sessionCounts = {};

  SESSIONS.forEach(
    function(session) {
      sessionCounts[session] = 0;
    }
  );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {

    const session =
      String(
        values[i][3] || ""
      ).trim();

    if (
      Object.prototype.hasOwnProperty.call(
        sessionCounts,
        session
      )
    ) {
      sessionCounts[session]++;
    }
  }

  let totalCheckins = 0;

  Object.keys(
    sessionCounts
  ).forEach(
    function(session) {
      totalCheckins +=
        sessionCounts[session];
    }
  );

  return {
    ok: true,
    totalCheckins:
      totalCheckins,
    sessions:
      sessionCounts,
  };
}


/******************************************************
 * SETUP
 ******************************************************/

function setupSheet() {

  const sheet =
    getRegistrationSheet();

  ensureHeaders(sheet);

  /*
   * Do not modify existing registration rows.
   * Only ensure the identifier columns are text.
   */
  prepareTextColumns(sheet);

  /*
   * Prepare Checkins sheet now so it exists before
   * the first check-in.
   */
  getCheckinsSheet();

  return jsonResponse({
    ok: true,
    message:
      "WCC registration and check-in sheets are ready.",
    registrationSheet:
      sheet.getName(),
    checkinsSheet:
      CHECKINS_SHEET_NAME,
    sessions:
      SESSIONS,
  });
}


/******************************************************
 * LIST SHEET TABS
 ******************************************************/

function listSheetTabs() {

  const spreadsheet =
    SpreadsheetApp.openById(
      SPREADSHEET_ID
    );

  const names =
    spreadsheet
      .getSheets()
      .map(
        function(sheet) {
          return sheet.getName();
        }
      );

  console.log(names);

  return jsonResponse({
    ok: true,
    sheets: names,
  });
}


/******************************************************
 * NORMALIZE CELL
 ******************************************************/

function normalizeCell(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (
    typeof value === "object"
  ) {
    return JSON.stringify(value);
  }

  return String(value);
}


/******************************************************
 * JSON RESPONSE
 ******************************************************/

function jsonResponse(body) {

  return ContentService
    .createTextOutput(
      JSON.stringify(body)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


/******************************************************
 * UNAUTHORIZED RESPONSE
 ******************************************************/

function unauthorizedResponse() {

  return jsonResponse({
    ok: false,
    authenticated: false,
    status: "unauthorized",
    error:
      "Admin login is required.",
  });
}
