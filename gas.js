/**************************************
 *  定数定義
 **************************************/
/** @const {string[]} 対象となるカレンダーID（メールアドレス） */
const CALENDAR_IDS = [
	"haruki.ikeda@algomatic.jp",
	"hiroki.tomono@algomatic.jp",
	"ryusuke.yokota@algomatic.jp",
	"ryusuke.yokota@algomatic.jp",
];

/** @const {string} スプレッドシートのシート名 */
const SHEET_NAME = "カレンダー予約データ";

/** @const {number} 取得開始日のオフセット（日数、過去の場合は負の値） */
const DAYS_BEFORE = 0;

/** @const {number} 取得終了日のオフセット（日数） */
const DAYS_AFTER = 60;

/** Notion API 定数 */
/** @const {string} Notion API キー */
const NOTION_API_KEY = "secret_4b8UPp9v1tnerUbe4oUKJ51Ay4guL2TSyg6LEd2HaNs";
/** @const {string} Notion データベースID */
const NOTION_DB_ID = "a964f40e440c47c095b2f21275a2fe2a";
/** @const {string} テンプレートページID（Notion上に存在するテンプレートページ） */
const NOTION_TEMPLATE_ID = "1819a86da3018019b2cdfaa366d97ec5"; // ←実際のテンプレートページIDに置き換えてください
/** @const {string} Notion API のエンドポイントURL */
const NOTION_API_URL = "https://api.notion.com/v1";
/** @const {Object} Notion API 呼び出し用ヘッダー */
const NOTION_HEADERS = {
	"Notion-Version": "2022-06-28",
	Authorization: `Bearer ${NOTION_API_KEY}`,
	"Content-Type": "application/json",
};

/**************************************
 *  メイン関数：定期実行用
 **************************************/
/**
 * 定期実行されるメイン関数。複数カレンダーからイベントを取得し、
 * イベントの主催者が指定のカレンダーID（メールアドレス）のいずれかと一致する場合、
 * スプレッドシートに追記し、Notion に新規ページを作成する。
 */
function storeCalendarEvents() {
	console.log("=== storeCalendarEvents START ===");

	const ss = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

	prepareHeader();

	const now = new Date();
	const startTime = shiftDate(now, -DAYS_BEFORE);
	const endTime = shiftDate(now, DAYS_AFTER);
	console.log(`取得期間: ${startTime} ~ ${endTime}`);

	const existingEventIds = getExistingEventIds();
	console.log(`既存イベントID数: ${existingEventIds.size}`);

	// 各カレンダーID毎にイベントを取得・処理
	for (const calendarId of CALENDAR_IDS) {
		const calendar = CalendarApp.getCalendarById(calendarId);
		if (!calendar) {
			console.error(`カレンダーが見つかりません: ${calendarId}`);
			return;
		}
		const calendarName = calendar.getName();
		console.log(`処理対象カレンダー: ${calendarName} (${calendarId})`);

		const events = calendar.getEvents(startTime, endTime);
		console.log(`イベント取得数 (${calendarName}): ${events.length}`);

		for (const event of events) {
			try {
				// Advanced Calendar API を使用して主催者のメールアドレスを取得
				const organizerEmail = getEventOrganizer(calendarId, event.getId());
				// 主催者が指定のカレンダーID（メールアドレス）のいずれかと一致する場合のみ処理
				if (CALENDAR_IDS.indexOf(organizerEmail) === -1) {
					continue;
				}
				const eventId = event.getId();
				if (!existingEventIds.has(eventId)) {
					console.log(`新規イベントを追加: ${eventId}, ${event.getTitle()}`);
					const eventData = extractEventData(event, calendarName);
					appendEventToSheet(eventData);
					createNotionPageFromEvent(eventData);
					// 同一実行内での重複防止
					existingEventIds.add(eventId);
				}
			} catch (error) {
				console.error(`イベント処理中にエラー: ${error}`);
				throw error;
			}
		}
	}

	console.log("=== storeCalendarEvents END ===");
}

/**************************************
 *  補助関数：カレンダー関連
 **************************************/
/**
 * 指定されたカレンダーIDとイベントIDから、イベントの主催者のメールアドレスを取得する。
 * Advanced Calendar API を使用するため、事前に有効化が必要です。
 *
 * @param {string} calendarId カレンダーID
 * @param {string} eventId イベントID
 * @returns {string} 主催者のメールアドレス
 */
function getEventOrganizer(calendarId, eventId) {
	const eventDetail = Calendar.Events.get(calendarId, eventId);
	const organizerEmail = eventDetail.organizer?.email || "";
	return organizerEmail;
}

/**
 * 基準日から指定日数分ずらした日付を返す。
 *
 * @param {Date} baseDate 基準となる日付
 * @param {number} days シフトする日数（正の値で未来、負の値で過去）
 * @returns {Date} シフト後の日付
 */
function shiftDate(baseDate, days) {
	const date = new Date(baseDate);
	date.setDate(date.getDate() + days);
	return date;
}

/**************************************
 *  補助関数：スプレッドシート操作
 **************************************/
/**
 * シートにヘッダー行が存在しない場合、ヘッダー行を作成する。
 */
function prepareHeader() {
	const ss = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = ss.getSheetByName(SHEET_NAME);
	const headers = [
		"Event ID",
		"件名",
		"開始日時",
		"終了日時",
		"参加者（社内）",
		"参加者（リソース）",
		"参加者（社外）",
		"予約者",
		"予約者メール",
		"会社名(ない場合ご所属)",
		"連絡方法",
		"打ち合わせで特に知りたいこと",
		"説明（その他）",
		"場所",
		"作成日時",
		"更新日時",
		"カレンダー名",
	];

	const firstRowValues = sheet
		.getRange(1, 1, 1, sheet.getMaxColumns())
		.getValues()[0];
	const hasHeader = firstRowValues.some((cell) => cell !== "");

	if (!hasHeader) {
		console.log("ヘッダーが存在しないため作成します");
		sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
	} else {
		console.log("既にヘッダーが存在します");
	}
}

/**
 * シート上の既存イベントIDの一覧を Set として返す。
 *
 * @returns {Set<string>} 既存のイベントIDのセット
 */
function getExistingEventIds() {
	const ss = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = ss.getSheetByName(SHEET_NAME);
	const data = sheet.getDataRange().getValues();
	if (data.length < 2) {
		return new Set();
	}
	const headers = data[0];
	const eventIdColIndex = headers.indexOf("Event ID");
	if (eventIdColIndex === -1) {
		console.error('ヘッダーに "Event ID" 列が見つかりませんでした');
		return new Set();
	}
	const eventIds = new Set();
	for (const row of data.slice(1)) {
		const id = row[eventIdColIndex];
		if (id) {
			eventIds.add(id);
		}
	}
	return eventIds;
}

/**
 * イベントデータをスプレッドシートに末尾として追加する。
 *
 * @param {Object} eventData 抽出されたイベントデータ
 */
function appendEventToSheet(eventData) {
	const ss = SpreadsheetApp.getActiveSpreadsheet();
	const sheet = ss.getSheetByName(SHEET_NAME);
	const rowData = [
		eventData.eventId,
		eventData.title,
		eventData.startTime,
		eventData.endTime,
		eventData.internalGuests,
		eventData.resourceGuests,
		eventData.externalGuests,
		eventData.reservationName,
		eventData.reservationEmail,
		eventData.companyName,
		eventData.contactMethod,
		eventData.interest,
		eventData.remainder,
		eventData.location,
		eventData.dateCreated,
		eventData.lastUpdated,
		eventData.calendarName,
	];
	sheet.appendRow(rowData);
	console.log(`appendEventToSheet: 追加完了 => EventID=${eventData.eventId}`);
}

/**************************************
 *  補助関数：イベントデータ抽出
 **************************************/
/**
 * カレンダーイベントから必要なデータを抽出してオブジェクトにまとめる。
 *
 * @param {CalendarEvent} event カレンダーイベントオブジェクト
 * @param {string} calendarName カレンダーの名称
 * @returns {Object} 抽出されたイベントデータ
 */
function extractEventData(event, calendarName) {
	const internalGuests = extractInternalGuests(event.getGuestList());
	const resourceGuests = extractResourceGuests(event.getGuestList());
	const externalGuests = extractExternalGuests(event.getGuestList());
	const desc = event.getDescription() || "";
	const descObj = parseDescription(desc);

	return {
		eventId: event.getId(),
		title: event.getTitle(),
		startTime: formatDateTime(event.getStartTime()),
		endTime: formatDateTime(event.getEndTime()),
		internalGuests: internalGuests,
		resourceGuests: resourceGuests,
		externalGuests: externalGuests,
		reservationName: descObj.reservationName || "",
		reservationEmail: descObj.reservationEmail || "",
		companyName: descObj.companyName || "",
		contactMethod: descObj.contactMethod || "",
		interest: descObj.interest || "",
		remainder: descObj.remainder || "",
		location: event.getLocation() || "",
		dateCreated: formatDateTime(event.getDateCreated()),
		lastUpdated: formatDateTime(event.getLastUpdated()),
		calendarName: calendarName,
		description: desc,
	};
}

/**
 * 参加者リストから内部（algomatic.jp）のメールアドレスのみを抽出し、
 * カンマ区切りの文字列にして返す。
 *
 * @param {Guest[]} guestList ゲストリスト
 * @returns {string} 内部参加者のメールアドレス（カンマ区切り）
 */
function extractInternalGuests(guestList) {
	const guests = guestList
		.map((guest) => {
			const email = guest.getEmail();
			const name = guest.getName() || "";
			return email.endsWith("@algomatic.jp")
				? name
					? `${name}: ${email}`
					: email
				: null;
		})
		.filter((g) => g !== null);
	return guests.join(", ");
}

/**
 * 参加者リストからリソース（resource.calendar.google.com）のメールアドレスのみを抽出し、
 * カンマ区切りの文字列にして返す。
 *
 * @param {Guest[]} guestList ゲストリスト
 * @returns {string} リソース参加者のメールアドレス（カンマ区切り）
 */
function extractResourceGuests(guestList) {
	const guests = guestList
		.map((guest) => {
			const email = guest.getEmail();
			const name = guest.getName() || "";
			return email.endsWith("@resource.calendar.google.com")
				? name
					? `${name}: ${email}`
					: email
				: null;
		})
		.filter((g) => g !== null);
	return guests.join(", ");
}

/**
 * 参加者リストから内部およびリソース以外のメールアドレスを抽出し、
 * カンマ区切りの文字列にして返す。
 *
 * @param {Guest[]} guestList ゲストリスト
 * @returns {string} 外部参加者のメールアドレス（カンマ区切り）
 */
function extractExternalGuests(guestList) {
	const guests = guestList
		.map((guest) => {
			const email = guest.getEmail();
			const name = guest.getName() || "";
			if (
				!email.endsWith("@algomatic.jp") &&
				!email.endsWith("@resource.calendar.google.com")
			) {
				return name ? `${name}: ${email}` : email;
			}
			return null;
		})
		.filter((g) => g !== null);
	return guests.join(", ");
}

/**
 * 日付オブジェクトを「yyyy/MM/dd HH:mm」形式の文字列に変換する。
 *
 * @param {Date} date 日付オブジェクト
 * @returns {string} 変換後の文字列
 */
function formatDateTime(date) {
	if (!date) return "";
	return Utilities.formatDate(
		date,
		Session.getScriptTimeZone(),
		"yyyy/MM/dd HH:mm",
	);
}

/**
 * イベントの説明文から各種情報を抽出する。
 *
 * @param {string} description HTML形式の説明文
 * @returns {Object} 抽出された情報
 */
function parseDescription(description) {
	if (!description) return {};
	const content = description
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<b>/gi, "")
		.replace(/<\/b>/gi, "")
		.trim();
	const lines = content
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l);

	const result = {
		reservationName: "",
		reservationEmail: "",
		companyName: "",
		interest: "",
		contactMethod: "",
		remainder: "",
	};

	const idxReservation = lines.findIndex((line) => line.includes("予約者:"));
	if (idxReservation !== -1) {
		if (lines[idxReservation + 1]) {
			result.reservationName = lines[idxReservation + 1];
		}
		if (lines[idxReservation + 2] && lines[idxReservation + 2].includes("@")) {
			result.reservationEmail = lines[idxReservation + 2];
		}
	}

	const idxCompany = lines.findIndex((line) => line.includes("会社名"));
	if (idxCompany !== -1 && lines[idxCompany + 1]) {
		result.companyName = lines[idxCompany + 1];
	}

	const idxInterest = lines.findIndex((line) =>
		line.includes("打ち合わせで特に知りたいこと"),
	);
	if (idxInterest !== -1 && lines[idxInterest + 1]) {
		result.interest = lines[idxInterest + 1];
	}

	const idxContact = lines.findIndex(
		(line) => line.includes("連絡方法") || line.includes("連絡方法(Gmail"),
	);
	if (idxContact !== -1 && lines[idxContact + 1]) {
		result.contactMethod = lines[idxContact + 1];
	}

	result.remainder = lines.join("\n");
	return result;
}

/**************************************
 *  補助関数：Notion 連携
 **************************************/
/**
 * イベントデータをもとに Notion に新規ページを作成し、
 * テンプレートページのブロックをコピーする。
 *
 * @param {Object} eventData 抽出されたイベントデータ
 */
function createNotionPageFromEvent(eventData) {
	try {
		const pageUrl = createNotionPage(eventData);
		console.log(`Notionページ作成完了: ${pageUrl}`);
		// 作成されたページのIDをURLから抽出してテンプレートをコピー
		copyTemplateBlocks(NOTION_TEMPLATE_ID, extractPageIdFromUrl(pageUrl));
	} catch (error) {
		console.error(`Notionページ作成中にエラー: ${error}`);
		throw error;
	}
}

/**
 * Notion API を使用して新規ページを作成する。
 *
 * @param {Object} eventData イベントデータ
 * @returns {string} 作成された Notion ページの URL
 */
function createNotionPage(eventData) {
	const url = `${NOTION_API_URL}/pages`;
	const payload = {
		parent: { database_id: NOTION_DB_ID },
		properties: {
			// タイトルプロパティ：カレンダー名を設定
			Title: {
				title: [
					{
						text: {
							content: eventData.calendarName,
						},
					},
				],
			},
			// 参加者プロパティ：内部参加者のメールアドレス（カンマ区切り）
			参加者: {
				rich_text: [
					{
						text: {
							content: eventData.internalGuests,
						},
					},
				],
			},
			// その他のプロパティは変更不要のため設定しない
		},
	};

	const options = {
		method: "post",
		headers: NOTION_HEADERS,
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	};

	const response = UrlFetchApp.fetch(url, options);
	const responseCode = response.getResponseCode();
	if (responseCode < 200 || responseCode >= 300) {
		console.error(`Notionページ作成失敗: ${response.getContentText()}`);
		throw new Error(`Notionページ作成失敗: HTTP ${responseCode}`);
	}

	const jsonResponse = JSON.parse(response.getContentText());
	return jsonResponse.url;
}

/**
 * テンプレートページからブロックを取得し、新規ページにコピーする。
 *
 * @param {string} fromId テンプレートページID
 * @param {string} toId 新規作成されたページID
 */
function copyTemplateBlocks(fromId, toId) {
	const blocks = getBlocks(fromId);
	const filteredBlocks = filterBlocks(blocks);
	updateBlocks(toId, filteredBlocks);
}

/**
 * 指定したブロックIDの子ブロックを取得する。
 *
 * @param {string} id ブロックID
 * @returns {Object[]} 子ブロックのリスト
 */
function getBlocks(id) {
	const url = `${NOTION_API_URL}/blocks/${id}/children`;
	const options = {
		method: "get",
		headers: NOTION_HEADERS,
		muteHttpExceptions: true,
	};
	const response = UrlFetchApp.fetch(url, options);
	if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
		console.error(`Notionブロック取得失敗: ${response.getContentText()}`);
		throw new Error(
			`Notionブロック取得失敗: HTTP ${response.getResponseCode()}`,
		);
	}
	const json = JSON.parse(response.getContentText());
	return json.results;
}

/**
 * 更新用にブロックをフィルタリングする。
 *
 * @param {Object[]} blocks ブロックの配列
 * @returns {Object[]} フィルタリングされたブロックの配列
 */
function filterBlocks(blocks) {
	return blocks.map((block) => {
		const j = { object: "block" };
		j.type = block.type;
		j[block.type] = block[block.type];
		return j;
	});
}

/**
 * 指定したページIDのブロックを更新（子ブロックを追加）する。
 *
 * @param {string} id ページID
 * @param {Object[]} blocks 追加するブロックの配列
 * @returns {Object[]} 更新されたブロックの配列
 */
function updateBlocks(id, blocks) {
	const url = `${NOTION_API_URL}/blocks/${id}/children`;
	const payload = { children: blocks };
	const options = {
		method: "patch",
		headers: NOTION_HEADERS,
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	};
	const response = UrlFetchApp.fetch(url, options);
	if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
		console.error(`Notionブロック更新失敗: ${response.getContentText()}`);
		throw new Error(
			`Notionブロック更新失敗: HTTP ${response.getResponseCode()}`,
		);
	}
	const json = JSON.parse(response.getContentText());
	return json.results;
}

/**
 * Notionページの URL からページ ID を抽出する。
 *
 * @param {string} url Notion ページの URL
 * @returns {string} ページ ID
 */
function extractPageIdFromUrl(url) {
	// NotionページURLの例: https://www.notion.so/algomatic/<pageId>?v=...
	const regex = /([0-9a-f]{32})/;
	const matches = url.replace(/-/g, "").match(regex);
	if (matches && matches.length > 1) {
		return matches[1];
	}
	if (matches) {
		return matches[0];
	}
	throw new Error("NotionページIDの抽出に失敗しました");
}
