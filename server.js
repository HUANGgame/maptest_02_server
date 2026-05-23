import http from "http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadDotEnv(path.join(__dirname, ".env"));

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TaipeiStationAdmin2026!";
const ADMIN_TOKEN = randomBytes(32).toString("hex");
const DB_ENABLED = String(process.env.DB_ENABLED || "true").toLowerCase() !== "false";
const DB_NAME = process.env.DB_NAME || "map_navigation";
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1600;
const METERS_PER_PIXEL = 0.6;
const GEO_MAP_BOUNDS = {
  north: 25.0526,
  south: 25.0442,
  west: 121.5106,
  east: 121.5228
};

const campusWalkwayCorridors = [
  { id: "main-spine", width: 86, points: [[440, 615], [520, 700], [585, 760], [590, 1010], [840, 1010], [1000, 880], [1130, 860]] },
  { id: "stadium-loop", width: 78, points: [[440, 615], [415, 650], [535, 1125], [765, 1195], [965, 1430]] },
  { id: "north-sports", width: 76, points: [[440, 615], [320, 345], [415, 650]] },
  { id: "engineering-link", width: 78, points: [[585, 760], [790, 735], [930, 690], [1120, 700], [1130, 860]] },
  { id: "student-link", width: 84, points: [[590, 1010], [610, 1060], [620, 1210], [620, 1330], [765, 1360], [940, 1430]] },
  { id: "library-ring", width: 78, points: [[930, 690], [1120, 700], [1120, 880], [995, 940], [925, 950], [840, 1010]] },
  { id: "bus-link", width: 72, points: [[790, 735], [840, 1010], [620, 1210]] },
  { id: "south-service", width: 70, points: [[620, 1210], [765, 1360], [965, 1430], [1165, 1340]] }
];

const floors = {
  campus: { id: "campus", nameZh: "淡水校園", nameEn: "Tamsui Campus", order: 1 },
  B1: { id: "B1", nameZh: "\u5730\u4e0b\u8857\u5c64", nameEn: "Underground Mall", order: 1 },
  B2: { id: "B2", nameZh: "\u6377\u904b\u5927\u5ef3", nameEn: "MRT Concourse", order: 2 },
  B3: { id: "B3", nameZh: "\u6377\u904b\u8f49\u4e58\u5c64", nameEn: "MRT Transfer", order: 3 }
};

const graphNodes = {
  M1: { x: 590, y: 125, labelZh: "M1/M2 \u5317\u5074\u901a\u9053", labelEn: "M1/M2 North Passage" },
  NORTH: { x: 540, y: 220, labelZh: "\u5317\u5074\u901a\u5eca", labelEn: "North Passage" },
  WEST: { x: 245, y: 355, labelZh: "\u897f\u5074\u901a\u5eca", labelEn: "West Passage" },
  CENTER: { x: 545, y: 360, labelZh: "\u53f0\u5317\u8eca\u7ad9 M \u5340\u4e2d\u592e", labelEn: "Taipei Station M Area Center" },
  EAST: { x: 745, y: 350, labelZh: "\u6771\u5074\u901a\u5eca", labelEn: "East Passage" },
  SOUTH: { x: 555, y: 535, labelZh: "\u7ad9\u524d\u5730\u4e0b\u8857\u9023\u901a", labelEn: "Station Front Mall Link" },
  M3: { x: 790, y: 545, labelZh: "M3 \u51fa\u53e3", labelEn: "Exit M3" },
  M4: { x: 675, y: 585, labelZh: "M4 \u51fa\u53e3", labelEn: "Exit M4" },
  M5: { x: 430, y: 595, labelZh: "M5 \u51fa\u53e3", labelEn: "Exit M5" },
  M6: { x: 520, y: 650, labelZh: "M6 \u51fa\u53e3", labelEn: "Exit M6" },
  M7: { x: 910, y: 565, labelZh: "M7 \u51fa\u53e3", labelEn: "Exit M7" },
  M8: { x: 680, y: 665, labelZh: "M8 \u51fa\u53e3", labelEn: "Exit M8" },
  ELEVATOR: { x: 630, y: 505, labelZh: "\u96fb\u68af / \u6a13\u68af", labelEn: "Elevator / Stairs" },
  RESTROOM: { x: 610, y: 455, labelZh: "\u5ec1\u6240", labelEn: "Restroom" },
  INFO: { x: 520, y: 320, labelZh: "\u670d\u52d9\u53f0 / \u8cc7\u8a0a", labelEn: "Information Desk" },
  Y_LINK: { x: 120, y: 355, labelZh: "\u53f0\u5317\u5730\u4e0b\u8857 Y \u5340", labelEn: "Taipei City Mall Y Area" },
  Z_LINK: { x: 560, y: 690, labelZh: "\u7ad9\u524d\u5730\u4e0b\u8857 Z \u5340", labelEn: "Station Front Mall Z Area" },
  K_LINK: { x: 760, y: 650, labelZh: "K \u5340 / \u7ad9\u524d\u5546\u5834", labelEn: "K Area / Taipei New World" },
  R_LINK: { x: 430, y: 125, labelZh: "\u4e2d\u5c71\u5730\u4e0b\u8857 R \u5340", labelEn: "Zhongshan Metro Mall R Area" }
};

const graphEdges = [
  ["M1", "NORTH"], ["NORTH", "CENTER"], ["WEST", "CENTER"], ["CENTER", "EAST"],
  ["CENTER", "SOUTH"], ["SOUTH", "M5"], ["SOUTH", "M6"], ["SOUTH", "M4"],
  ["SOUTH", "ELEVATOR"], ["ELEVATOR", "M3"], ["EAST", "M3"], ["M3", "M7"],
  ["M4", "M8"], ["WEST", "Y_LINK"], ["SOUTH", "Z_LINK"], ["M4", "K_LINK"],
  ["NORTH", "R_LINK"], ["CENTER", "INFO"], ["ELEVATOR", "RESTROOM"]
];

Object.assign(graphNodes, {
  M1_A: { x: 585, y: 165, labelZh: "M1/M2 連通道", labelEn: "M1/M2 Link" },
  NORTH_A: { x: 560, y: 205, labelZh: "北側轉角", labelEn: "North Corner" },
  NORTH_B: { x: 520, y: 255, labelZh: "北側通道南端", labelEn: "North Passage South End" },
  CENTER_W: { x: 455, y: 360, labelZh: "中央西側通道", labelEn: "Center West Passage" },
  CENTER_E: { x: 630, y: 360, labelZh: "中央東側通道", labelEn: "Center East Passage" },
  SOUTH_A: { x: 545, y: 430, labelZh: "中央往南通道", labelEn: "Center South Passage" },
  SOUTH_B: { x: 550, y: 485, labelZh: "站前連通北端", labelEn: "Station Front Link North" },
  M3_A: { x: 700, y: 515, labelZh: "M3 西側轉角", labelEn: "M3 West Corner" },
  M4_A: { x: 640, y: 570, labelZh: "M4 通道", labelEn: "M4 Passage" },
  Y_A: { x: 185, y: 355, labelZh: "Y 區入口通道", labelEn: "Y Area Entrance" },
  Z_A: { x: 555, y: 610, labelZh: "Z 區入口通道", labelEn: "Z Area Entrance" },
  K_A: { x: 715, y: 625, labelZh: "K 區入口通道", labelEn: "K Area Entrance" },
  R_A: { x: 470, y: 170, labelZh: "R 區入口通道", labelEn: "R Area Entrance" }
});

graphEdges.push(
  ["M1", "M1_A"], ["M1_A", "NORTH_A"], ["NORTH_A", "NORTH"], ["NORTH", "NORTH_B"], ["NORTH_B", "CENTER"],
  ["WEST", "Y_A"], ["Y_A", "CENTER_W"], ["CENTER_W", "CENTER"], ["CENTER", "CENTER_E"], ["CENTER_E", "EAST"],
  ["CENTER", "SOUTH_A"], ["SOUTH_A", "SOUTH_B"], ["SOUTH_B", "SOUTH"], ["SOUTH", "M4_A"], ["M4_A", "M4"],
  ["SOUTH", "Z_A"], ["Z_A", "Z_LINK"], ["M4", "K_A"], ["K_A", "K_LINK"], ["NORTH", "R_A"], ["R_A", "R_LINK"],
  ["SOUTH_B", "ELEVATOR"], ["ELEVATOR", "M3_A"], ["M3_A", "M3"]
);

const places = {
  M1: place(590, 125, "M1 / M2 \u51fa\u53e3", "Exit M1 / M2", "M1", "M", ["m1", "m2", "\u6377\u904b"]),
  M3: place(790, 545, "M3 \u51fa\u53e3", "Exit M3", "M3", "M", ["m3"]),
  M4: place(675, 585, "M4 \u51fa\u53e3", "Exit M4", "M4", "M", ["m4"]),
  M5: place(430, 595, "M5 \u51fa\u53e3", "Exit M5", "M5", "M", ["m5"]),
  M6: place(520, 650, "M6 \u51fa\u53e3", "Exit M6", "M6", "M", ["m6"]),
  M7: place(910, 565, "M7 \u51fa\u53e3", "Exit M7", "M7", "M", ["m7"]),
  M8: place(680, 665, "M8 \u51fa\u53e3", "Exit M8", "M8", "M", ["m8"]),
  yMall: place(120, 355, "\u53f0\u5317\u5730\u4e0b\u8857 Y \u5340", "Taipei City Mall Y Area", "Y_LINK", "Y", ["y", "y\u5340", "\u53f0\u5317\u5730\u4e0b\u8857", "\u52d5\u6f2b", "\u96fb\u73a9", "\u6a21\u578b", "anime", "game"]),
  zMall: place(560, 690, "\u7ad9\u524d\u5730\u4e0b\u8857 Z \u5340", "Station Front Mall Z Area", "Z_LINK", "Z", ["z", "z\u5340", "\u7ad9\u524d", "\u7ad9\u524d\u5730\u4e0b\u8857", "station front"]),
  kMall: place(760, 650, "K \u5340 / \u7ad9\u524d\u5546\u5834", "K Area / Taipei New World", "K_LINK", "K", ["k", "k\u5340", "\u6771\u68ee", "\u7ad9\u524d\u5546\u5834", "\u65b0\u4e16\u754c"]),
  rMall: place(430, 125, "\u4e2d\u5c71\u5730\u4e0b\u8857 R \u5340", "Zhongshan Metro Mall R Area", "R_LINK", "R", ["r", "r\u5340", "\u4e2d\u5c71", "\u4e2d\u5c71\u5730\u4e0b\u8857", "zhongshan"]),
  food: place(555, 535, "\u7f8e\u98df / \u9910\u98f2", "Food / Dining", "SOUTH", "food", ["\u7f8e\u98df", "\u9910\u98f2", "\u5403\u98ef", "\u98df\u7269", "food", "dining"]),
  shopping: place(245, 355, "\u8cfc\u7269 / \u670d\u98fe\u96dc\u8ca8", "Shopping / Fashion", "WEST", "shopping", ["\u8cfc\u7269", "\u670d\u98fe", "\u96dc\u8ca8", "\u8cb7\u6771\u897f", "shopping", "fashion"]),
  elevator: place(630, 505, "\u96fb\u68af / \u6a13\u68af", "Elevator / Stairs", "ELEVATOR", "facility", ["\u96fb\u68af", "\u6a13\u68af", "elevator", "stairs"]),
  restroom: place(610, 455, "\u5ec1\u6240", "Restroom", "RESTROOM", "facility", ["\u5ec1\u6240", "\u6d17\u624b\u9593", "toilet", "restroom", "wc"]),
  info: place(520, 320, "\u670d\u52d9\u53f0 / \u8cc7\u8a0a", "Information Desk", "INFO", "facility", ["\u670d\u52d9\u53f0", "\u8cc7\u8a0a", "\u8a62\u554f\u8655", "info", "information"])
};

const destinationCategories = [
  category("all", "\u5168\u90e8", "All"),
  category("M", "M \u5340\uff1a\u6377\u904b\u5730\u4e0b\u5546\u5834 / M \u51fa\u53e3", "M Area: MRT Mall / M exits"),
  category("Y", "Y \u5340\uff1a\u53f0\u5317\u5730\u4e0b\u8857", "Y Area: Taipei City Mall"),
  category("Z", "Z \u5340\uff1a\u7ad9\u524d\u5730\u4e0b\u8857", "Z Area: Station Front Mall"),
  category("K", "K \u5340\uff1aK \u5340\u5730\u4e0b\u8857 / \u7ad9\u524d\u5546\u5834", "K Area: K Underground Mall"),
  category("R", "R \u5340\uff1a\u4e2d\u5c71\u5730\u4e0b\u8857", "R Area: Zhongshan Metro Mall"),
  category("food", "\u7f8e\u98df / \u9910\u98f2", "Food / Dining"),
  category("shopping", "\u8cfc\u7269 / \u670d\u98fe / \u52d5\u6f2b", "Shopping / Fashion / Anime"),
  category("facility", "\u8a2d\u65bd\uff1a\u5ec1\u6240\u3001\u96fb\u68af\u3001\u670d\u52d9\u53f0", "Facilities"),
  category("Y-food", "Y \u5340\u5e97\u92ea\uff1a\u7f8e\u98df\u5340", "Y Shops: Food"),
  category("Y-info", "Y \u5340\u5e97\u92ea\uff1a\u8cc7\u8a0a\u5340", "Y Shops: Info / Hobby"),
  category("Y-dept", "Y \u5340\u5e97\u92ea\uff1a\u767e\u8ca8\u5340", "Y Shops: General Goods"),
  category("Y-fashion", "Y \u5340\u5e97\u92ea\uff1a\u670d\u98fe\u5340", "Y Shops: Fashion")
];

const storeDirectory = [
  yStore("Y27-1", "\u5b8f\u8a18\u4fbf\u7576", "Hong Ji Bento", "Y-food", 70, ["\u4fbf\u7576", "bento"]),
  yStore("Y27-2", "\u963f\u5b97\u9eb5\u7dda", "Ay-Chung Noodle", "Y-food", 75, ["\u9eb5\u7dda", "noodle"]),
  yStore("Y25-1", "\u6843\u5712\u820a\u99ac\u8def", "Taoyuan Old Road", "Y-food", 150),
  yStore("Y25-2", "\u842c\u80fd\u9910\u98f2", "All-purpose Dining", "Y-food", 160, ["\u9910\u98f2", "dining"]),
  yStore("Y23-1", "\u6625\u85e4\u5496\u5561", "Spring Vine Coffee", "Y-food", 240, ["\u5496\u5561", "coffee"]),
  yStore("Y23-2", "Tomica", "Tomica", "Y-food", 250, ["\u73a9\u5177", "toy"]),
  yStore("Y23-3", "\u6607\u5143\u9999\u9175\u574a", "Sheng Yuan Bakery", "Y-food", 260, ["\u70d8\u7119", "bakery"]),
  yStore("Y21-1", "\u8aa0\u54c1\u751f\u6d3b\u6377\u904b\u5e97", "Eslite Spectrum Metro", "Y-food", 340, ["\u8aa0\u54c1", "eslite"]),
  yStore("Y21-2", "\u53ef\u4e0d\u53ef\u719f\u6210\u7d05\u8336", "Kebuke Tea", "Y-food", 355, ["\u98f2\u6599", "\u7d05\u8336", "tea"]),
  yStore("Y19-1", "\u52dd\u535a\u6bbf", "Saboten", "Y-info", 430, ["\u8c6c\u6392", "saboten"]),
  yStore("Y19-2", "\u597d\u6642\u5149", "Good Time", "Y-info", 440),
  yStore("Y19-3", "Syariah", "Syariah", "Y-info", 450),
  yStore("Y17-1", "TGK \u5361\u7247\u73a9\u5177\u5c08\u8ce3\u5e97", "TGK Card & Toy Store", "Y-info", 520, ["\u5361\u7247", "\u73a9\u5177", "card", "toy"]),
  yStore("Y17-2", "\u661f\u8056\u96fb\u7af6\u4e3b\u984c\u9910\u5ef3", "E-sports Theme Restaurant", "Y-info", 535, ["\u96fb\u7af6", "esports"]),
  yStore("Y15-1", "\u5c0f\u6f58\u86cb\u7cd5\u574a", "Pan Cake Shop", "Y-info", 600, ["\u86cb\u7cd5", "cake"]),
  yStore("Y15-2", "\u73a9\u5177\u5f37", "Toy Strong", "Y-info", 610, ["\u73a9\u5177", "toy"]),
  yStore("Y13-1", "\u65e5\u85e5\u672c\u8216", "Japanese Drugstore", "Y-dept", 690, ["\u85e5\u599d", "drugstore"]),
  yStore("Y13-2", "\u62db\u5546\u4e2d", "Vacant Shop", "Y-dept", 700, ["\u7a7a\u92ea", "vacant"]),
  yStore("Y13-3", "\u6c38\u5eb7\u9999\u5712", "Yong Kang Food", "Y-dept", 710),
  yStore("Y11-1", "\u5b89\u4e1e\u6c34\u6676", "Crystal Shop", "Y-fashion", 760, ["\u6c34\u6676", "crystal"]),
  yStore("Y11-2", "\u975c\u7d72\u54c1", "Jing Si Goods", "Y-fashion", 770),
  yStore("Y11-3", "\u79fb\u52d5\u5be6\u9a57\u5ba4", "Mobile Lab", "Y-fashion", 780, ["\u624b\u6a5f", "mobile"]),
  yStore("Y9-1", "\u68ee\u6797\u5c0f\u92ea", "Forest Shop", "Y-fashion", 835),
  yStore("Y9-2", "\u9435\u677f\u6599\u7406", "Teppanyaki", "Y-fashion", 845, ["\u9435\u677f", "teppanyaki"]),
  yStore("Y7-1", "\u7c73\u6f3f MIKI", "MIKI", "Y-fashion", 900, ["miki"]),
  yStore("Y7-2", "\u4f0a\u6d0b\u884c", "I House", "Y-fashion", 910, ["i house"]),
  yStore("Y5-1", "\u65b0\u6d41\u884c\u5bbf", "Fashion Inn", "Y-fashion", 965, ["\u670d\u98fe", "fashion"]),
  yStore("Y5-2", "Top 3C", "Top 3C", "Y-fashion", 975, ["3c", "\u96fb\u5b50"]),
  yStore("Y3-1", "Mr. Pink", "Mr. Pink", "Y-fashion", 1030, ["pink"]),
  yStore("Y3-2", "CLC INDEX", "CLC INDEX", "Y-fashion", 1040),
  yStore("Y1-1", "\u6b63\u6d0b\u4e2d", "Zheng Yang", "Y-fashion", 1080),
  yStore("Y1-2", "\u88d5\u745e\u5a5a", "Wedding Shop", "Y-fashion", 1090, ["\u5a5a\u7d17", "wedding"])
];

for (const store of storeDirectory) {
  places[store.id] = storePlace(store);
}

const areaExitDirectory = [
  ...[
    ["Y1", 1085], ["Y2U", 1060], ["Y3", 1035], ["Y4", 1010], ["Y5", 965], ["Y6", 945],
    ["Y7", 905], ["Y8", 875], ["Y9", 840], ["Y10", 815], ["Y11", 780], ["Y12", 750],
    ["Y13", 700], ["Y15", 615], ["Y17", 535], ["Y19", 450], ["Y20U", 380], ["Y21", 350],
    ["Y22", 320], ["Y23", 265], ["Y24U", 230], ["Y25", 165], ["Y26", 125], ["Y27", 75], ["Y28", 45]
  ].map(([code, x]) => mallExit(code, "Y", "Y_LINK", Number(x), 355, "\u53f0\u5317\u5730\u4e0b\u8857", "Taipei City Mall")),
  ...[
    ["Z1", 760], ["Z2", 720], ["Z3", 680], ["Z4", 650], ["Z5", 610], ["Z6", 575],
    ["Z7", 530], ["Z8", 500], ["Z9", 470], ["Z10", 430]
  ].map(([code, x]) => mallExit(code, "Z", "Z_LINK", Number(x), 690, "\u7ad9\u524d\u5730\u4e0b\u8857", "Station Front Metro Mall")),
  ...[
    ["K1", 880, 650], ["K2", 845, 650], ["K3", 805, 650], ["K4", 785, 650], ["K5", 815, 675], ["K6", 760, 650],
    ["K7", 735, 630], ["K8", 710, 650], ["K9", 690, 630], ["K10", 650, 690], ["K11", 620, 610], ["K12", 590, 650]
  ].map(([code, x, y]) => mallExit(code, "K", "K_LINK", Number(x), Number(y), "K \u5340\u5730\u4e0b\u8857", "K Underground Mall")),
  ...[
    ["R1", 460], ["R2", 455], ["R4", 450], ["R5", 445], ["R6", 440], ["R7", 435], ["R8", 430]
  ].map(([code, x]) => mallExit(code, "R", "R_LINK", Number(x), 125, "\u4e2d\u5c71\u5730\u4e0b\u8857", "Zhongshan Metro Mall")),
  mallExit("M2", "M", "M1", 610, 125, "\u6377\u904b\u5730\u4e0b\u8857", "MRT Mall"),
  mallExit("\u53f0\u5317\u8eca\u7ad9", "M", "CENTER", 545, 360, "\u53f0\u5317\u8eca\u7ad9", "Taipei Main Station", ["taipei main station", "main station", "\u5317\u8eca"])
];

places.mainStation = place(545, 360, "\u53f0\u5317\u8eca\u7ad9", "Taipei Main Station", "CENTER", "M", ["\u5317\u8eca", "\u53f0\u5317\u8eca\u7ad9", "\u81fa\u5317\u8eca\u7ad9", "taipei main station", "main station"]);

for (const exit of areaExitDirectory) {
  places[exit.id] = exitPlace(exit);
}

installTamkangCampusDemoData();

const mapSources = [
  {
    title: "Taipei Station underground mall layout",
    url: "https://commons.wikimedia.org/wiki/File:%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99%E5%9C%B0%E4%B8%8B%E8%A1%97%E9%85%8D%E7%BD%AE%E5%9C%96.png",
    noteZh: "\u516c\u958b\u914d\u7f6e\u5716\u6a19\u793a R\u3001Y\u3001Z\u3001K\u3001M \u5404\u5340\u76f8\u5c0d\u4f4d\u7f6e\u3002",
    noteEn: "Public layout map showing R, Y, Z, K, and M areas."
  },
  {
    title: "Taipei City Government area-code note",
    url: "https://www.gov.taipei/News_Content.aspx?n=EEC70A4186D4C828&s=5B692574C86ACDF3&sms=87415A8B9CE81B16",
    noteZh: "\u81fa\u5317\u5e02\u8cc7\u6599\u8aaa\u660e\u5317\u8eca\u7279\u5b9a\u5340\u6709 Y\u3001Z\u3001R\u3001K \u7b49\u5730\u4e0b\u8857\u4ee3\u865f\u3002",
    noteEn: "Taipei City note describing Y, Z, R, and K underground-street codes."
  },
  {
    title: "Taipei Station K Underground Mall",
    url: "https://zh.wikipedia.org/wiki/%E5%8F%B0%E5%8C%97%E8%BB%8A%E7%AB%99K%E5%8D%80%E5%9C%B0%E4%B8%8B%E8%A1%97",
    noteZh: "K \u5340\u5730\u4e0b\u8857\u4f4d\u65bc\u53f0\u5317\u8eca\u7ad9\u7ad9\u524d\u5ee3\u5834\u5730\u4e0b\uff0c\u5171\u6709 K1-K12 \u51fa\u5165\u53e3\u8cc7\u6599\u3002",
    noteEn: "K Underground Mall is under Taipei Main Station front plaza and has K1-K12 exits."
  },
  {
    title: "Station Front Metro Mall",
    url: "https://zh.wikipedia.org/wiki/%E7%AB%99%E5%89%8D%E5%9C%B0%E4%B8%8B%E8%A1%97",
    noteZh: "\u7ad9\u524d\u5730\u4e0b\u8857\u53c8\u7a31 Z \u5340\u5730\u4e0b\u8857\uff0c\u7528\u65bc\u5c0d\u61c9 Z \u5340\u4f4d\u7f6e\u8207\u51fa\u53e3\u3002",
    noteEn: "Station Front Metro Mall is also known as the Z area."
  },
  {
    title: "Taipei City Mall",
    url: "https://zh.wikipedia.org/wiki/%E5%8F%B0%E5%8C%97%E5%9C%B0%E4%B8%8B%E8%A1%97",
    noteZh: "\u53f0\u5317\u5730\u4e0b\u8857\u53c8\u7a31 Y \u5340\uff0c\u51fa\u53e3\u4ee5 Y \u70ba\u7de8\u865f\u3002",
    noteEn: "Taipei City Mall is also known as the Y area."
  },
  {
    title: "User supplied Taipei Underground Street surrounding-area map",
    url: "#",
    noteZh: "\u4f7f\u7528\u8005\u63d0\u4f9b\u7684\u5468\u908a\u5340\u57df\u5716\uff0c\u7528\u65bc\u6574\u7406 Y\u3001K\u3001Z\u3001R\u3001M \u51fa\u53e3\u7d22\u5f15\u3002",
    noteEn: "User-provided surrounding-area map used to organize Y, K, Z, R, and M exit indexes."
  }
];

const defaultState = {
  mapBoards: [
    { id: "TKU-GA-BOARD", nameZh: "淡江大門校園導覽圖", nameEn: "Tamkang Main Gate Campus Map", floor: "campus", x: 440, y: 615, heading: 0, referenceHash: "", note: "淡水校園 demo 校正點" },
    { id: "TKU-LIB-BOARD", nameZh: "圖書館前導覽圖", nameEn: "Library Area Campus Map", floor: "campus", x: 995, y: 830, heading: 0, referenceHash: "", note: "圖書館附近 demo 校正點" },
    { id: "TKU-STUDENT-BOARD", nameZh: "學生活動中心導覽圖", nameEn: "Student Activity Area Campus Map", floor: "campus", x: 795, y: 1210, heading: 0, referenceHash: "", note: "學生活動中心附近 demo 校正點" }
  ],
  accessPoints: [
    { id: "AP-TKU-GA", name: "TKU Main Gate Demo AP", ip: "10.20.1.11", ssid: "TKU-Demo", floor: "campus", x: 440, y: 615, note: "Demo AP. Replace with real campus AP inventory." },
    { id: "AP-TKU-LIB", name: "TKU Library Demo AP", ip: "10.20.1.12", ssid: "TKU-Demo", floor: "campus", x: 995, y: 830, note: "Demo AP. Replace with real campus AP inventory." },
    { id: "AP-TKU-STUDENT", name: "TKU Student Area Demo AP", ip: "10.20.1.13", ssid: "TKU-Demo", floor: "campus", x: 795, y: 1210, note: "Demo AP. Replace with real campus AP inventory." }
  ],
  wifiFingerprints: [
    { id: "WF-TKU-GA", labelZh: "大門 Wi-Fi 指紋", labelEn: "Main Gate Wi-Fi Fingerprint", floor: "campus", x: 440, y: 615, samples: [{ bssid: "aa:aa:aa:00:01", ssid: "TKU-Demo", rssi: -45 }, { bssid: "aa:aa:aa:00:02", ssid: "TKU-Library", rssi: -78 }] },
    { id: "WF-TKU-LIB", labelZh: "圖書館 Wi-Fi 指紋", labelEn: "Library Wi-Fi Fingerprint", floor: "campus", x: 995, y: 830, samples: [{ bssid: "aa:aa:aa:00:02", ssid: "TKU-Library", rssi: -48 }, { bssid: "aa:aa:aa:00:03", ssid: "TKU-Student", rssi: -72 }] },
    { id: "WF-TKU-STUDENT", labelZh: "活動中心 Wi-Fi 指紋", labelEn: "Student Area Wi-Fi Fingerprint", floor: "campus", x: 795, y: 1210, samples: [{ bssid: "aa:aa:aa:00:03", ssid: "TKU-Student", rssi: -44 }, { bssid: "aa:aa:aa:00:02", ssid: "TKU-Library", rssi: -70 }] }
  ],
  obstacles: [
    { id: "OB-STADIUM", floor: "campus", labelZh: "操場草地不可穿越", labelEn: "Stadium field blocked", x: 185, y: 205, w: 395, h: 360, status: "active" },
    { id: "OB-ADMIN", floor: "campus", labelZh: "行政教學建築群", labelEn: "Administration buildings", x: 610, y: 780, w: 165, h: 210, status: "active" },
    { id: "OB-LIB", floor: "campus", labelZh: "圖書館建築", labelEn: "Library building", x: 895, y: 715, w: 210, h: 195, status: "active" },
    { id: "OB-BUSINESS", floor: "campus", labelZh: "商管大樓建築", labelEn: "Business building", x: 1050, y: 915, w: 210, h: 235, status: "active" },
    { id: "OB-STUDENT", floor: "campus", labelZh: "學生生活區建築", labelEn: "Student area buildings", x: 650, y: 1080, w: 250, h: 240, status: "active" },
    { id: "OB-SLOPE", floor: "campus", labelZh: "陡坡與植栽避開區", labelEn: "Slope and planting blocked", x: 410, y: 940, w: 200, h: 260, status: "active" }
  ],
  sessions: {},
  events: [],
  parkingRecords: [],
  learnedNodes: {},
  learnedEdges: [],
  lastPositions: {},
  destinationOverrides: {}
};

let state = structuredClone(defaultState);
let dbPool = null;
let storageMode = "json";

function place(x, y, labelZh, labelEn, node, categoryId, aliases = []) {
  return { x, y, labelZh, labelEn, node, category: categoryId, aliases };
}

function category(id, labelZh, labelEn) {
  return { id, labelZh, labelEn };
}

function yStore(shopNo, nameZh, nameEn, categoryId, x, aliases = []) {
  return {
    id: `store-${shopNo.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    shopNo,
    nameZh,
    nameEn,
    floor: "B1",
    area: "Y",
    node: "Y_LINK",
    category: categoryId,
    x: clamp(x, 0, CANVAS_WIDTH, 120),
    y: 355,
    aliases: [shopNo, shopNo.replace(/-/g, ""), nameZh, nameEn, "\u53f0\u5317\u5730\u4e0b\u8857", "Y\u5340", "Taipei City Mall", ...aliases]
  };
}

function mallExit(code, area, node, x, y, areaZh, areaEn, aliases = []) {
  const id = `exit-${String(code).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const codeText = String(code);
  return {
    id,
    code: codeText,
    floor: "B1",
    area,
    areaZh,
    areaEn,
    node,
    category: area,
    x: clamp(x, 0, CANVAS_WIDTH, 545),
    y: clamp(y, 0, CANVAS_HEIGHT, 360),
    aliases: [codeText, codeText.replace(/-/g, ""), `${codeText}\u51fa\u53e3`, `${area}\u5340`, areaZh, areaEn, ...aliases]
  };
}

function storePlace(store) {
  return {
    x: store.x,
    y: store.y,
    labelZh: `${store.shopNo} ${store.nameZh}`,
    labelEn: `${store.shopNo} ${store.nameEn}`,
    node: store.node,
    category: store.category,
    aliases: store.aliases,
    shopNo: store.shopNo,
    storeNameZh: store.nameZh,
    storeNameEn: store.nameEn,
    area: store.area,
    floor: store.floor
  };
}

function exitPlace(exit) {
  return {
    x: exit.x,
    y: exit.y,
    labelZh: `${exit.code} \u51fa\u53e3 / ${exit.areaZh}`,
    labelEn: `${exit.code} Exit / ${exit.areaEn}`,
    node: exit.node,
    category: exit.category,
    aliases: exit.aliases,
    exitCode: exit.code,
    area: exit.area,
    floor: exit.floor
  };
}

function installTamkangCampusDemoData() {
  for (const key of Object.keys(graphNodes)) delete graphNodes[key];
  graphEdges.splice(0, graphEdges.length);
  for (const key of Object.keys(places)) delete places[key];
  destinationCategories.splice(0, destinationCategories.length,
    category("all", "全部", "All"),
    category("gate", "校門 / 守衛室", "Gates"),
    category("academic", "教學大樓", "Academic"),
    category("student", "學生服務", "Student Services"),
    category("sports", "運動場館", "Sports"),
    category("scenery", "景點 / 休憩", "Scenery"),
    category("transport", "交通 / 公車", "Transport")
  );
  storeDirectory.splice(0, storeDirectory.length);
  areaExitDirectory.splice(0, areaExitDirectory.length);

  Object.assign(graphNodes, {
    mainGate: { x: 440, y: 615, labelZh: "大門管制站", labelEn: "Main Entrance Guard House" },
    stadiumNorth: { x: 320, y: 345, labelZh: "操場北側", labelEn: "Stadium North" },
    stadiumSouth: { x: 415, y: 650, labelZh: "操場南側", labelEn: "Stadium South" },
    centerRound: { x: 620, y: 845, labelZh: "蛋捲廣場 / 中央圓環", labelEn: "Central Round Plaza" },
    adminRoad: { x: 760, y: 895, labelZh: "行政大樓前道路", labelEn: "Administration Road" },
    libraryRoad: { x: 925, y: 950, labelZh: "圖書館前道路", labelEn: "Library Road" },
    businessRoad: { x: 1030, y: 980, labelZh: "商管大樓前道路", labelEn: "Business Road" },
    studentRoad: { x: 765, y: 1195, labelZh: "學生生活區道路", labelEn: "Student Area Road" },
    engineeringRoad: { x: 930, y: 690, labelZh: "工學大樓前道路", labelEn: "Engineering Road" },
    busStop: { x: 790, y: 735, labelZh: "公車站", labelEn: "Bus Stop" },
    sceneryLoop: { x: 535, y: 1125, labelZh: "休憩景點步道", labelEn: "Scenery Walk" },
    southGate: { x: 965, y: 1430, labelZh: "南側出口", labelEn: "South Exit" }
  });
  graphEdges.push(
    ["mainGate", "stadiumNorth"], ["mainGate", "stadiumSouth"], ["stadiumSouth", "centerRound"],
    ["centerRound", "adminRoad"], ["adminRoad", "libraryRoad"], ["libraryRoad", "businessRoad"],
    ["centerRound", "studentRoad"], ["studentRoad", "sceneryLoop"], ["studentRoad", "southGate"],
    ["adminRoad", "engineeringRoad"], ["engineeringRoad", "busStop"], ["busStop", "businessRoad"],
    ["stadiumSouth", "sceneryLoop"]
  );

  const campusPlaces = {
    mainGate: place(440, 615, "大門管制站（GA）", "Main Entrance Guard House", "mainGate", "gate", ["大門", "入口", "GA", "gate"]),
    reviewingStand: place(325, 360, "司令臺（P）", "Reviewing Stand", "stadiumNorth", "sports", ["司令台", "操場", "P"]),
    natatorium: place(510, 640, "紹謨紀念游泳館（N）", "Shao-mo Memorial Natatorium", "stadiumSouth", "sports", ["游泳館", "游泳池", "N"]),
    internationalCenter: place(665, 770, "守謙國際會議中心（HC）", "Hsu Shou-Chlien International Conference Center", "centerRound", "academic", ["守謙", "HC", "會議中心"]),
    liuHsien: place(705, 820, "騮先紀念科學館（S）", "Liu-hsien Memorial Science Hall", "centerRound", "academic", ["科學館", "S"]),
    chemistry: place(705, 1035, "鍾靈化學館（C）", "Chung-ling Chemistry Hall", "studentRoad", "academic", ["化學館", "C"]),
    communicationQ: place(830, 1030, "傳播館（Q）", "Communication Hall", "studentRoad", "academic", ["傳播館", "Q"]),
    liberalArts: place(930, 910, "文學館（L）", "College of Liberal Arts", "libraryRoad", "academic", ["文學館", "L"]),
    library: place(995, 830, "覺生紀念圖書館（U）", "Chueh-sheng Memorial Library", "libraryRoad", "student", ["圖書館", "U", "library"]),
    business: place(1130, 1035, "商管大樓（B）", "Business and Management Building", "businessRoad", "academic", ["商管", "B"]),
    engineering: place(915, 690, "工學館（G）", "Engineering Building", "engineeringRoad", "academic", ["工學館", "G"]),
    education: place(1045, 735, "教育館（ED）", "College of Education", "engineeringRoad", "academic", ["教育館", "ED"]),
    admin: place(710, 900, "行政大樓（A）", "Administration Building", "adminRoad", "student", ["行政", "A"]),
    activity: place(795, 1210, "學生活動中心（R）", "Student Activity Center", "studentRoad", "student", ["活動中心", "R"]),
    busStop: place(790, 735, "公車站", "Bus Stop", "busStop", "transport", ["公車", "bus"]),
    sceneryA: place(500, 1015, "克難坡", "Overcoming Difficulties Slope", "sceneryLoop", "scenery", ["克難坡", "A"]),
    sceneryO: place(790, 1115, "書卷廣場", "University Commons", "studentRoad", "scenery", ["書卷", "廣場", "O"]),
    southExit: place(965, 1430, "南側出口", "South Exit", "southGate", "gate", ["出口", "南側"])
  };
  Object.assign(places, campusPlaces);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mapToGeo(point) {
  const lon = GEO_MAP_BOUNDS.west + (Number(point.x) / CANVAS_WIDTH) * (GEO_MAP_BOUNDS.east - GEO_MAP_BOUNDS.west);
  const lat = GEO_MAP_BOUNDS.north - (Number(point.y) / CANVAS_HEIGHT) * (GEO_MAP_BOUNDS.north - GEO_MAP_BOUNDS.south);
  return { lat, lon };
}

function geoMeters(a, b) {
  const earthRadius = 6371000;
  const left = mapToGeo(a);
  const right = mapToGeo(b);
  const dLat = (right.lat - left.lat) * Math.PI / 180;
  const dLon = (right.lon - left.lon) * Math.PI / 180;
  const lat1 = left.lat * Math.PI / 180;
  const lat2 = right.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += geoMeters(points[i - 1], points[i]);
  }
  return Math.max(1, Math.round(total));
}

function tinyWalkModel(edge, baseDistance) {
  const count = Math.max(0, Number(edge.count || 0));
  const normalizedDistance = Math.min(1, baseDistance / 180);
  const learnedConfidence = Math.min(1, Math.log1p(count) / Math.log(12));
  const score = 1 / (1 + Math.exp(-(2.2 * learnedConfidence - 1.1 * normalizedDistance)));
  return Math.max(0.42, 1 - score * 0.48);
}

function buildAdjacency(nodes = graphNodes, edges = graphEdges) {
  const out = Object.fromEntries(Object.keys(nodes).map(key => [key, []]));
  for (const rawEdge of edges) {
    const a = Array.isArray(rawEdge) ? rawEdge[0] : rawEdge.a;
    const b = Array.isArray(rawEdge) ? rawEdge[1] : rawEdge.b;
    if (!nodes[a] || !nodes[b] || !out[a] || !out[b]) continue;
    const baseDistance = distance(nodes[a], nodes[b]);
    const weight = Array.isArray(rawEdge) ? baseDistance : baseDistance * tinyWalkModel(rawEdge, baseDistance);
    out[a].push({ node: b, weight });
    out[b].push({ node: a, weight });
  }
  return out;
}

const adjacency = buildAdjacency();

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function dbConnectionConfig(includeDatabase = true) {
  if (!DB_ENABLED) return null;
  const host = process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD;
  const port = Number(process.env.DB_PORT || 3306);
  if (!password) return null;
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error("DB_NAME must contain only letters, numbers, and underscores.");
  return {
    host,
    user,
    password,
    port,
    ...(includeDatabase ? { database: DB_NAME } : {}),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 5
  };
}

async function initDatabase() {
  const baseConfig = dbConnectionConfig(false);
  if (!baseConfig) return false;
  try {
    const setupConnection = await mysql.createConnection(baseConfig);
    await setupConnection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await setupConnection.end();

    dbPool = mysql.createPool(dbConnectionConfig(true));
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        state_key VARCHAR(64) PRIMARY KEY,
        state_value JSON NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS navigation_logs (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(120) NOT NULL,
        event_type VARCHAR(80) NOT NULL,
        payload JSON NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_navigation_logs_session_created (session_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS places (
        id VARCHAR(120) PRIMARY KEY,
        label_zh VARCHAR(160) NOT NULL,
        label_en VARCHAR(160) NULL,
        category VARCHAR(80) NULL,
        floor_id VARCHAR(40) NOT NULL,
        x DOUBLE NOT NULL,
        y DOUBLE NOT NULL,
        aliases JSON NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_places_category_floor (category, floor_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS obstacles (
        id VARCHAR(36) PRIMARY KEY,
        floor_id VARCHAR(40) NOT NULL,
        label VARCHAR(160) NOT NULL,
        geometry JSON NOT NULL,
        status ENUM('active','cleared') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_obstacles_floor_status (floor_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS parking_records (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(120) NOT NULL,
        floor_id VARCHAR(40) NOT NULL,
        x DOUBLE NOT NULL,
        y DOUBLE NOT NULL,
        note VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_parking_records_session_created (session_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(120) NULL,
        report_type VARCHAR(80) NOT NULL,
        target_id VARCHAR(120) NULL,
        message TEXT NOT NULL,
        status ENUM('open','reviewing','resolved','rejected') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_reports_status_created (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    storageMode = "mysql";
    return true;
  } catch (error) {
    dbPool = null;
    console.warn("[storage] MySQL init failed:", error.message);
    return false;
  }
}

async function loadStateFromDatabase() {
  const [rows] = await dbPool.query("SELECT state_key, state_value FROM app_state");
  if (!rows.length) return null;
  const saved = {};
  for (const row of rows) {
    saved[row.state_key] = typeof row.state_value === "string" ? JSON.parse(row.state_value) : row.state_value;
  }
  return saved;
}

async function seedDatabaseFromJsonOrDefault() {
  let seed = currentPersistedState();
  try {
    seed = {
      ...seed,
      ...JSON.parse(await readFile(dataFile, "utf8"))
    };
  } catch {
    // No JSON file yet; seed from defaults.
  }
  await saveStateObjectToDatabase(seed);
}

async function saveStateToDatabase() {
  await saveStateObjectToDatabase(currentPersistedState());
}

async function saveStateObjectToDatabase(nextState) {
  const entries = Object.entries(nextState).map(([key, value]) => [key, JSON.stringify(value)]);
  if (!entries.length) return;
  await dbPool.query(
    "INSERT INTO app_state (state_key, state_value) VALUES ? ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)",
    [entries]
  );
}

async function loadState() {
  if (await initDatabase()) {
    try {
      const saved = await loadStateFromDatabase();
      if (saved) {
        applySavedState(saved);
        return;
      }
      await seedDatabaseFromJsonOrDefault();
      const seeded = await loadStateFromDatabase();
      if (seeded) {
        applySavedState(seeded);
        return;
      }
    } catch (error) {
      console.warn("[storage] MySQL unavailable, falling back to JSON:", error.message);
      storageMode = "json";
    }
  }

  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    applySavedState(saved);
  } catch {
    await saveState();
  }
}

function applySavedState(saved = {}) {
  state = {
    ...structuredClone(defaultState),
    ...saved,
    mapBoards: migrateBoards(saved.mapBoards),
    accessPoints: migrateAccessPoints(saved.accessPoints),
    wifiFingerprints: migrateWifiFingerprints(saved.wifiFingerprints),
    sessions: saved.sessions && typeof saved.sessions === "object" ? saved.sessions : {},
    events: Array.isArray(saved.events) ? saved.events : [],
    parkingRecords: Array.isArray(saved.parkingRecords) ? saved.parkingRecords : [],
    obstacles: Array.isArray(saved.obstacles) ? saved.obstacles : structuredClone(defaultState.obstacles),
    learnedNodes: saved.learnedNodes && typeof saved.learnedNodes === "object" ? saved.learnedNodes : {},
    learnedEdges: Array.isArray(saved.learnedEdges) ? saved.learnedEdges : [],
    lastPositions: saved.lastPositions && typeof saved.lastPositions === "object" ? saved.lastPositions : {},
    destinationOverrides: saved.destinationOverrides && typeof saved.destinationOverrides === "object" ? saved.destinationOverrides : {}
  };
}

function migrateBoards(boards) {
  if (!Array.isArray(boards) || boards.length === 0) return structuredClone(defaultState.mapBoards);
  const oldDemoData = boards.some(board => ["B-WEST-01", "B-CENTER-01", "B-EAST-01", "A-CENTER-01", "C-CENTER-01", "M-B1-CENTER-01", "M-B1-EAST-01", "M-B1-SOUTH-01", "M-B1-WEST-01"].includes(board.id));
  if (oldDemoData) return structuredClone(defaultState.mapBoards);
  return boards.map(board => ({
    id: clean(board.id, 80) || randomUUID(),
    nameZh: clean(board.nameZh || board.name, 120) || clean(board.id, 80),
    nameEn: clean(board.nameEn || board.name, 120) || clean(board.id, 80),
    floor: floors[board.floor] ? board.floor : "campus",
    x: clamp(board.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(board.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    heading: clamp(board.heading, 0, 359, 0),
    referenceHash: clean(board.referenceHash, 512),
    note: clean(board.note, 400)
  }));
}

function migrateAccessPoints(accessPoints) {
  if (!Array.isArray(accessPoints) || !accessPoints.some(ap => String(ap.id || "").startsWith("AP-TKU"))) return structuredClone(defaultState.accessPoints);
  return accessPoints;
}

function migrateWifiFingerprints(fingerprints) {
  if (!Array.isArray(fingerprints) || fingerprints.length === 0) return structuredClone(defaultState.wifiFingerprints);
  return fingerprints;
}

async function saveState() {
  if (storageMode === "mysql" && dbPool) {
    await saveStateToDatabase();
    return;
  }
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(currentPersistedState(), null, 2), "utf8");
}

function currentPersistedState() {
  return {
    mapBoards: state.mapBoards,
    accessPoints: state.accessPoints,
    wifiFingerprints: state.wifiFingerprints,
    obstacles: state.obstacles,
    sessions: state.sessions,
    events: state.events.slice(-800),
    parkingRecords: (state.parkingRecords || []).slice(-300),
    learnedNodes: state.learnedNodes,
    learnedEdges: state.learnedEdges.slice(-2000),
    lastPositions: state.lastPositions,
    destinationOverrides: state.destinationOverrides || {}
  };
}

function learnedNodeId(point) {
  const x = Math.round(Number(point.x) / 18) * 18;
  const y = Math.round(Number(point.y) / 18) * 18;
  const floor = floors[point.floor] ? point.floor : "campus";
  return `L-${floor}-${x}-${y}`;
}

function normalizedLearnedEdges() {
  const out = [];
  const seen = new Set();
  for (const edge of state.learnedEdges || []) {
    if (!edge?.a || !edge?.b || edge.a === edge.b) continue;
    const key = [edge.a, edge.b].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

function learnedGraph() {
  const learnedNodes = {};
  const connectorEdges = [];
  for (const [id, node] of Object.entries(state.learnedNodes || {})) {
    if (!Number.isFinite(Number(node.x)) || !Number.isFinite(Number(node.y))) continue;
    learnedNodes[id] = {
      x: Number(node.x),
      y: Number(node.y),
      floor: node.floor || "campus",
      labelZh: "\u5df2\u5b78\u7fd2\u53ef\u901a\u884c\u9ede",
      labelEn: "Learned Walkable Point"
    };
    const nearest = nearestNode({ floor: learnedNodes[id].floor, x: learnedNodes[id].x, y: learnedNodes[id].y }, graphNodes);
    if (nearest.distance <= 95) connectorEdges.push([id, nearest.key]);
  }
  return {
    nodes: { ...graphNodes, ...learnedNodes },
    edges: [...graphEdges, ...normalizedLearnedEdges(), ...connectorEdges]
  };
}

function nearestNode(point, nodes = graphNodes) {
  let bestKey = "CENTER";
  let bestDistance = Infinity;
  for (const [key, node] of Object.entries(nodes)) {
    if (node.floor && point.floor && node.floor !== point.floor) continue;
    const d = distance(point, node);
    if (d < bestDistance) {
      bestKey = key;
      bestDistance = d;
    }
  }
  return { key: bestKey, distance: bestDistance };
}

function aStarPath(startKey, endKey, nodes = graphNodes, adj = adjacency) {
  if (!nodes[startKey] || !nodes[endKey]) return { pathKeys: [], totalDistance: Infinity, rawDistance: Infinity, algorithm: "A*" };
  const open = new Set([startKey]);
  const previous = {};
  const gScore = Object.fromEntries(Object.keys(nodes).map(key => [key, Infinity]));
  const fScore = Object.fromEntries(Object.keys(nodes).map(key => [key, Infinity]));
  gScore[startKey] = 0;
  fScore[startKey] = distance(nodes[startKey], nodes[endKey]);

  while (open.size > 0) {
    let current = null;
    for (const key of open) {
      if (current === null || fScore[key] < fScore[current]) current = key;
    }
    if (current === endKey) break;
    open.delete(current);

    for (const edge of adj[current] || []) {
      if (!nodes[edge.node]) continue;
      const tentative = gScore[current] + Number(edge.weight || distance(nodes[current], nodes[edge.node]));
      if (tentative >= gScore[edge.node]) continue;
      previous[edge.node] = current;
      gScore[edge.node] = tentative;
      fScore[edge.node] = tentative + distance(nodes[edge.node], nodes[endKey]);
      open.add(edge.node);
    }
  }

  const pathKeys = [];
  let cursor = endKey;
  while (cursor) {
    pathKeys.unshift(cursor);
    cursor = previous[cursor];
  }
  if (pathKeys[0] !== startKey) return { pathKeys: [], totalDistance: Infinity, rawDistance: Infinity, algorithm: "A*" };
  let rawDistance = 0;
  for (let i = 1; i < pathKeys.length; i += 1) {
    rawDistance += distance(nodes[pathKeys[i - 1]], nodes[pathKeys[i]]);
  }
  return { pathKeys, totalDistance: gScore[endKey], rawDistance, algorithm: "A*" };
}

function activeObstacles(floor = "campus") {
  return (state.obstacles || defaultState.obstacles || [])
    .filter(item => (item.floor || "campus") === floor && (item.status || "active") === "active")
    .map(item => ({
      id: clean(item.id, 80),
      floor: item.floor || "campus",
      labelZh: clean(item.labelZh || item.label, 120) || "障礙物",
      labelEn: clean(item.labelEn || item.label, 120) || "Obstacle",
      x: clamp(item.x, 0, CANVAS_WIDTH, 0),
      y: clamp(item.y, 0, CANVAS_HEIGHT, 0),
      w: clamp(item.w, 1, CANVAS_WIDTH, 1),
      h: clamp(item.h, 1, CANVAS_HEIGHT, 1)
    }));
}

function pointInRect(point, rect, padding = 8) {
  return point.x >= rect.x - padding && point.x <= rect.x + rect.w + padding
    && point.y >= rect.y - padding && point.y <= rect.y + rect.h + padding;
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!len2) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

function insideCampusWalkway(point, padding = 0) {
  if ((point.floor || "campus") !== "campus") return true;
  return campusWalkwayCorridors.some(corridor => {
    for (let i = 1; i < corridor.points.length; i += 1) {
      const a = { x: corridor.points[i - 1][0], y: corridor.points[i - 1][1] };
      const b = { x: corridor.points[i][0], y: corridor.points[i][1] };
      if (distanceToSegment(point, a, b) <= corridor.width / 2 + padding) return true;
    }
    return false;
  });
}

function segmentInsideCampusWalkway(a, b) {
  if ((a.floor || "campus") !== "campus" && (b.floor || "campus") !== "campus") return true;
  const steps = Math.max(2, Math.ceil(distance(a, b) / 18));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, floor: "campus" };
    if (!insideCampusWalkway(point, 12)) return false;
  }
  return true;
}

function nearestCampusWalkwayPoint(point, obstacles) {
  if ((point.floor || "campus") !== "campus") return null;
  let best = null;
  let bestDistance = Infinity;
  for (const corridor of campusWalkwayCorridors) {
    for (let i = 1; i < corridor.points.length; i += 1) {
      const from = { x: corridor.points[i - 1][0], y: corridor.points[i - 1][1], floor: "campus" };
      const to = { x: corridor.points[i][0], y: corridor.points[i][1], floor: "campus" };
      const steps = Math.max(1, Math.ceil(distance(from, to) / 24));
      for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const candidate = {
          x: Math.round(from.x + (to.x - from.x) * t),
          y: Math.round(from.y + (to.y - from.y) * t),
          floor: "campus"
        };
        if (obstacles.some(rect => pointInRect(candidate, rect))) continue;
        const d = distance(point, candidate);
        if (d < bestDistance) {
          best = candidate;
          bestDistance = d;
        }
      }
    }
  }
  return best;
}

function segmentBlocked(a, b, obstacles) {
  const steps = Math.max(2, Math.ceil(distance(a, b) / 18));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (obstacles.some(rect => pointInRect(point, rect))) return true;
  }
  return false;
}

function nearestWalkablePoint(point, obstacles, spacing = 80) {
  const clamped = {
    x: clamp(point.x, 40, CANVAS_WIDTH - 40, CANVAS_WIDTH / 2),
    y: clamp(point.y, 40, CANVAS_HEIGHT - 40, CANVAS_HEIGHT / 2),
    floor: point.floor || "campus"
  };
  if (!obstacles.some(rect => pointInRect(clamped, rect)) && insideCampusWalkway(clamped, 34)) return clamped;
  const corridorPoint = nearestCampusWalkwayPoint(clamped, obstacles);
  if (corridorPoint) return corridorPoint;
  let best = clamped;
  let bestDistance = Infinity;
  for (let radius = spacing; radius <= 520; radius += spacing) {
    for (let dx = -radius; dx <= radius; dx += spacing) {
      for (let dy = -radius; dy <= radius; dy += spacing) {
        const candidate = {
          x: clamp(clamped.x + dx, 40, CANVAS_WIDTH - 40, clamped.x),
          y: clamp(clamped.y + dy, 40, CANVAS_HEIGHT - 40, clamped.y),
          floor: clamped.floor
        };
        if (obstacles.some(rect => pointInRect(candidate, rect))) continue;
        if (!insideCampusWalkway(candidate, 34)) continue;
        const d = distance(clamped, candidate);
        if (d < bestDistance) {
          best = candidate;
          bestDistance = d;
        }
      }
    }
    if (Number.isFinite(bestDistance)) return best;
  }
  return best;
}

function buildWalkableGridRoute(start, destination, floor = "campus") {
  const obstacles = activeObstacles(floor);
  const spacing = 80;
  const nodes = {};
  const edges = [];
  const startPoint = nearestWalkablePoint({ ...start, floor }, obstacles, spacing);
  const endPoint = nearestWalkablePoint({ ...destination, floor }, obstacles, spacing);
  nodes.START = { ...startPoint, labelZh: "目前位置", labelEn: "Current Location", floor };
  nodes.END = { ...endPoint, labelZh: destination.labelZh || "目的地", labelEn: destination.labelEn || "Destination", floor };

  for (let x = 80; x <= CANVAS_WIDTH - 80; x += spacing) {
    for (let y = 80; y <= CANVAS_HEIGHT - 80; y += spacing) {
      const point = { x, y, floor };
      if (obstacles.some(rect => pointInRect(point, rect))) continue;
      if (!insideCampusWalkway(point, 24)) continue;
      nodes[`G-${x}-${y}`] = { ...point, labelZh: "可通行點", labelEn: "Walkable point" };
    }
  }

  if (floor === "campus") {
    for (const corridor of campusWalkwayCorridors) {
      for (let i = 1; i < corridor.points.length; i += 1) {
        const from = { x: corridor.points[i - 1][0], y: corridor.points[i - 1][1], floor };
        const to = { x: corridor.points[i][0], y: corridor.points[i][1], floor };
        const steps = Math.max(1, Math.ceil(distance(from, to) / 48));
        for (let step = 0; step <= steps; step += 1) {
          const t = step / steps;
          const point = {
            x: Math.round(from.x + (to.x - from.x) * t),
            y: Math.round(from.y + (to.y - from.y) * t),
            floor
          };
          if (obstacles.some(rect => pointInRect(point, rect))) continue;
          nodes[`W-${corridor.id}-${i}-${step}`] = { ...point, labelZh: "步道點", labelEn: "Walkway point" };
        }
      }
    }
  }

  const keys = Object.keys(nodes);
  for (const key of keys) {
    const node = nodes[key];
    for (const otherKey of keys) {
      if (key >= otherKey) continue;
      const other = nodes[otherKey];
      const d = distance(node, other);
      const connectLimit = key === "START" || key === "END" || otherKey === "START" || otherKey === "END" ? spacing * 1.65 : spacing * 1.42;
      if (d > connectLimit) continue;
      if (segmentBlocked(node, other, obstacles)) continue;
      if (!segmentInsideCampusWalkway(node, other)) continue;
      edges.push([key, otherKey]);
    }
  }

  const result = aStarPath("START", "END", nodes, buildAdjacency(nodes, edges));
  const path = result.pathKeys.map(key => ({ id: key, ...nodes[key] }));
  return {
    pathKeys: result.pathKeys,
    path,
    obstacles,
    totalDistance: result.rawDistance,
    totalMeters: pathMeters(path.length ? path : [startPoint, endPoint]),
    algorithm: "A* walkable-grid",
    model: "astar-obstacle-grid-v2"
  };
}

function route(body, req) {
  const allPlaces = resolvedPlaces();
  const currentFloor = floors[body.currentFloor] ? body.currentFloor : "campus";
  const destFloor = floors[body.destFloor] ? body.destFloor : currentFloor;
  const destPlace = allPlaces[body.destPlace] ? body.destPlace : "mainGate";
  const position = { floor: currentFloor, x: Number(body.position?.x), y: Number(body.position?.y) };
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return jsonError(400, "position.x and position.y must be numbers.");
  const customDestination = body.destinationPoint && Number.isFinite(Number(body.destinationPoint.x)) && Number.isFinite(Number(body.destinationPoint.y))
    ? {
      floor: floors[body.destinationPoint.floor] ? body.destinationPoint.floor : destFloor,
      x: clamp(body.destinationPoint.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
      y: clamp(body.destinationPoint.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
      labelZh: clean(body.destinationPoint.labelZh, 120) || "自訂目的地",
      labelEn: clean(body.destinationPoint.labelEn, 120) || "Custom destination",
      node: "CUSTOM",
      category: "custom"
    }
    : null;
  const sameFloor = currentFloor === (customDestination?.floor || destFloor);
  const routeTarget = customDestination ? "custom" : (sameFloor ? destPlace : "elevator");
  const destination = customDestination || allPlaces[routeTarget];
  const gridRoute = buildWalkableGridRoute(position, destination, currentFloor);
  const snap = { key: "START", distance: distance(position, gridRoute.path[0] || position) };
  if (!Number.isFinite(gridRoute.totalDistance) || gridRoute.pathKeys.length === 0) {
    const fallbackPath = [position, destination];
    return jsonOk({
      currentFloor,
      destFloor,
      destPlace,
      routeTarget,
      sameFloor,
      verticalDirection: "same",
      start: { x: position.x, y: position.y, nearestNode: snap.key, snapDistance: Math.round(snap.distance) },
      destination,
      path: [destination],
      pathKeys: [destination.node],
      totalDistance: Math.round(distance(position, destination)),
      totalMeters: pathMeters(fallbackPath),
      obstacles: activeObstacles(currentFloor),
      learnedEdges: state.learnedEdges.length,
      learnedNodes: Object.keys(state.learnedNodes).length,
      algorithm: "A*",
      model: "astar-wifi-motion-v1-fallback"
    });
  }
  const path = gridRoute.path.filter(item => Number.isFinite(item.x));
  const totalMeters = gridRoute.totalMeters;
  const verticalDiff = floors[destFloor].order - floors[currentFloor].order;
  const verticalDirection = verticalDiff > 0 ? "down" : verticalDiff < 0 ? "up" : "same";
  const sessionId = clean(body.sessionId, 80);
  if (sessionId) recordSession(sessionId, "route", {
    currentFloor,
    destFloor,
    destPlace,
    customDestination,
    position,
    motion: normalizeMotion(body.motion),
    accessPoint: nearestAccessPoint({ floor: currentFloor, x: position.x, y: position.y }),
    routeTarget,
    totalDistance: Math.round(gridRoute.totalDistance),
    totalMeters,
    obstacles: gridRoute.obstacles.map(item => item.id),
    clientIp: clientIp(req)
  });
  return jsonOk({
    currentFloor,
    destFloor,
    destPlace,
    customDestination,
    routeTarget,
    sameFloor,
    verticalDirection,
    start: { x: position.x, y: position.y, nearestNode: snap.key, snapDistance: Math.round(snap.distance) },
    destination,
    path,
    pathKeys: gridRoute.pathKeys,
    totalDistance: Math.round(gridRoute.totalDistance),
    totalMeters,
    obstacles: gridRoute.obstacles,
    learnedEdges: state.learnedEdges.length,
    learnedNodes: Object.keys(state.learnedNodes).length,
    algorithm: gridRoute.algorithm,
    model: gridRoute.model
  });
}

function normalizeMotion(value = {}) {
  return {
    steps: clamp(value.steps, 0, 100000, 0),
    heading: clamp(value.heading, 0, 359, 0),
    strideMeters: clamp(value.strideMeters, 0.2, 1.2, 0.68),
    source: clean(value.source, 60) || "phone-motion"
  };
}

function learnGpsLocation(body, req) {
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  const floor = floors[body.floor] ? body.floor : "campus";
  const point = {
    floor,
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    lat: Number(body.lat),
    lon: Number(body.lon),
    accuracy: Number(body.accuracy)
  };
  const nodeId = learnedNodeId(point);
  const previousNode = state.learnedNodes[nodeId];
  state.learnedNodes[nodeId] = {
    id: nodeId,
    floor,
    x: point.x,
    y: point.y,
    seen: (previousNode?.seen || 0) + 1,
    lastSeen: new Date().toISOString()
  };
  const last = state.lastPositions[sessionId];
  let learned = false;
  if (last?.nodeId && last.nodeId !== nodeId) {
    const lastNode = state.learnedNodes[last.nodeId];
    const d = lastNode ? distance(point, lastNode) : 0;
    if (d >= 10 && d <= 180) {
      const [a, b] = [last.nodeId, nodeId].sort();
      const edgeKey = `${a}|${b}`;
      const edge = state.learnedEdges.find(item => item.key === edgeKey);
      if (edge) {
        edge.count = (edge.count || 1) + 1;
        edge.lastSeen = new Date().toISOString();
      } else {
        state.learnedEdges.push({ key: edgeKey, a, b, floor, count: 1, lastSeen: new Date().toISOString() });
      }
      learned = true;
    }
  }
  state.lastPositions[sessionId] = { nodeId, floor, x: point.x, y: point.y, at: new Date().toISOString() };
  recordSession(sessionId, "motion-location", {
    floor,
    position: { x: point.x, y: point.y },
    gps: Number.isFinite(point.lat) && Number.isFinite(point.lon) ? { lat: point.lat, lon: point.lon, accuracy: point.accuracy } : null,
    learned,
    learnedNodes: Object.keys(state.learnedNodes).length,
    learnedEdges: state.learnedEdges.length,
    clientIp: clientIp(req)
  });
  return jsonOk({ ok: true, learned, nodeId, learnedNodes: Object.keys(state.learnedNodes).length, learnedEdges: state.learnedEdges.length });
}

function nearestAccessPoint(point) {
  const candidates = state.accessPoints.filter(ap => ap.floor === point.floor);
  if (candidates.length === 0) return null;
  let best = candidates[0];
  let bestDistance = distance(point, best);
  for (const ap of candidates.slice(1)) {
    const d = distance(point, ap);
    if (d < bestDistance) {
      best = ap;
      bestDistance = d;
    }
  }
  return { id: best.id, name: best.name, ip: best.ip, ssid: best.ssid, floor: best.floor, x: Number(best.x), y: Number(best.y), distance: Math.round(bestDistance) };
}

function normalizeWifiSamples(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = value.split(/\r?\n/).map(line => {
        const [bssid, ssid, rssi] = line.split(/[,|\t]/).map(part => part.trim());
        return { bssid, ssid, rssi: Number(rssi) };
      });
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map(item => ({
    bssid: clean(item.bssid || item.BSSID || item.mac, 80).toLowerCase(),
    ssid: clean(item.ssid || item.SSID || "", 80),
    rssi: clamp(item.rssi ?? item.level ?? item.RSSI, -100, -20, -90)
  })).filter(item => item.bssid || item.ssid).slice(0, 80);
}

function wifiSimilarity(scan, fingerprint) {
  const observed = new Map(scan.map(item => [item.bssid || item.ssid, item]));
  let score = 0;
  let matches = 0;
  for (const sample of normalizeWifiSamples(fingerprint.samples)) {
    const key = sample.bssid || sample.ssid;
    const hit = observed.get(key);
    if (!hit) {
      score += 35;
      continue;
    }
    matches += 1;
    score += Math.min(35, Math.abs(Number(hit.rssi) - Number(sample.rssi)));
  }
  score += Math.max(0, scan.length - matches) * 3;
  return { score, matches };
}

function locateByWifi(body, req) {
  const scan = normalizeWifiSamples(body.scan || body.samples || body.wifi);
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  if (scan.length === 0) {
    const fingerprints = state.wifiFingerprints || [];
    if (fingerprints.length === 0) return jsonError(404, "No Wi-Fi fingerprint is registered. Add it in admin first.");
    const previous = state.sessions[sessionId]?.current?.location;
    const best = previous
      ? fingerprints.map(fingerprint => ({ fingerprint, d: distance(previous, fingerprint) })).sort((a, b) => a.d - b.d)[0].fingerprint
      : fingerprints[0];
    const location = {
      source: "server-wifi-fingerprint",
      confidence: 0.82,
      fingerprintId: best.id,
      fingerprintNameZh: best.labelZh,
      fingerprintNameEn: best.labelEn,
      floor: best.floor || "campus",
      x: Math.round(Number(best.x)),
      y: Math.round(Number(best.y)),
      accessPoint: nearestAccessPoint({ floor: best.floor || "campus", x: Number(best.x), y: Number(best.y) })
    };
    recordSession(sessionId, "wifi-location", { location, serverSide: true, clientIp: clientIp(req) });
    return jsonOk({ sessionId, location, candidates: fingerprints.slice(0, 3).map(item => ({ id: item.id, labelZh: item.labelZh, labelEn: item.labelEn, score: 0, matches: 0 })) });
  }
  const candidates = (state.wifiFingerprints || []).map(fingerprint => {
    const result = wifiSimilarity(scan, fingerprint);
    return { fingerprint, ...result };
  }).filter(item => item.matches > 0).sort((a, b) => a.score - b.score);
  if (candidates.length === 0) return jsonError(404, "No Wi-Fi fingerprint matched. Add samples in admin first.");
  const top = candidates.slice(0, 3);
  const weightSum = top.reduce((sum, item) => sum + 1 / Math.max(1, item.score), 0);
  const x = top.reduce((sum, item) => sum + Number(item.fingerprint.x) * (1 / Math.max(1, item.score)), 0) / weightSum;
  const y = top.reduce((sum, item) => sum + Number(item.fingerprint.y) * (1 / Math.max(1, item.score)), 0) / weightSum;
  const best = top[0].fingerprint;
  const location = {
    source: "wifi-fingerprint",
    confidence: Number(Math.max(0.2, Math.min(0.98, top[0].matches / Math.max(scan.length, normalizeWifiSamples(best.samples).length))).toFixed(2)),
    fingerprintId: best.id,
    fingerprintNameZh: best.labelZh,
    fingerprintNameEn: best.labelEn,
    floor: best.floor || "campus",
    x: Math.round(x),
    y: Math.round(y),
    accessPoint: nearestAccessPoint({ floor: best.floor || "campus", x, y })
  };
  recordSession(sessionId, "wifi-location", { location, matches: top.map(item => ({ id: item.fingerprint.id, score: Math.round(item.score), matches: item.matches })), clientIp: clientIp(req) });
  return jsonOk({ sessionId, location, candidates: top.map(item => ({ id: item.fingerprint.id, labelZh: item.fingerprint.labelZh, labelEn: item.fingerprint.labelEn, score: Math.round(item.score), matches: item.matches })) });
}

function updateWifiFingerprint(body) {
  const id = clean(body.id, 80) || `WF-${Date.now().toString().slice(-6)}`;
  const samples = normalizeWifiSamples(body.samples || body.scan || body.wifi);
  if (samples.length === 0) return jsonError(400, "At least one Wi-Fi sample is required.");
  const fingerprint = {
    id,
    labelZh: clean(body.labelZh, 120) || id,
    labelEn: clean(body.labelEn, 120) || id,
    floor: floors[body.floor] ? body.floor : "campus",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    samples,
    note: clean(body.note, 400),
    updatedAt: new Date().toISOString()
  };
  const index = state.wifiFingerprints.findIndex(item => item.id === id);
  if (index >= 0) state.wifiFingerprints[index] = fingerprint;
  else state.wifiFingerprints.push(fingerprint);
  state.events.push({
    id: randomUUID(),
    sessionId: "admin",
    type: "wifi-fingerprint-save",
    at: new Date().toISOString(),
    payload: { id, floor: fingerprint.floor, x: fingerprint.x, y: fingerprint.y, samples: samples.length }
  });
  state.events = state.events.slice(-800);
  void saveState();
  return jsonOk({ fingerprint, wifiFingerprints: state.wifiFingerprints });
}

function resolvedPlaces() {
  const overrides = state.destinationOverrides || {};
  return Object.fromEntries(Object.entries(places).map(([id, placeData]) => {
    const override = overrides[id] || {};
    return [id, {
      ...placeData,
      ...override,
      aliases: Array.isArray(override.aliases) ? override.aliases : placeData.aliases,
      edited: Boolean(overrides[id]?.updatedAt),
      baseX: placeData.x,
      baseY: placeData.y,
      baseFloor: placeData.floor || "campus"
    }];
  }));
}

function resolveDestination(body) {
  const query = normalizeSearch(body.query);
  if (!query) return jsonError(400, "query is required.");
  const candidates = Object.entries(resolvedPlaces()).map(([id, placeData]) => {
    const tokens = [id, placeData.labelZh, placeData.labelEn, placeData.category, ...(placeData.aliases || [])].map(normalizeSearch);
    let score = 0;
    for (const token of tokens) {
      if (!token) continue;
      if (token === query) score = Math.max(score, 100);
      else if (token.includes(query)) score = Math.max(score, 80);
      else if (query.includes(token)) score = Math.max(score, 65);
    }
    return { id, place: placeData, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (candidates.length === 0) return jsonError(404, "No destination matched.");
  return jsonOk({ best: { id: candidates[0].id, ...candidates[0].place, score: candidates[0].score }, matches: candidates.slice(0, 8).map(item => ({ id: item.id, ...item.place, score: item.score })) });
}

function normalizeSearch(value) {
  return clean(value, 120).toLowerCase().replace(/\s+/g, "").replace(/[()（）/／_-]/g, "");
}

function recordSession(sessionId, type, payload) {
  const at = new Date().toISOString();
  const session = state.sessions[sessionId] || { id: sessionId, firstSeen: at, lastSeen: at, eventCount: 0, current: {} };
  session.lastSeen = at;
  session.eventCount += 1;
  session.current = { ...session.current, ...payload };
  state.sessions[sessionId] = session;
  const event = { id: randomUUID(), sessionId, type, at, payload };
  state.events.push(event);
  state.events = state.events.slice(-800);
  void saveNavigationLog(event);
  void saveState();
}

async function saveNavigationLog(event) {
  if (storageMode !== "mysql" || !dbPool) return;
  try {
    await dbPool.query(
      "INSERT INTO navigation_logs (id, session_id, event_type, payload, created_at) VALUES (?, ?, ?, CAST(? AS JSON), ?)",
      [event.id, event.sessionId, event.type, JSON.stringify(event.payload || {}), event.at.replace("T", " ").replace("Z", "")]
    );
  } catch (error) {
    console.warn("[storage] Failed to write navigation log:", error.message);
  }
}

function adminSummary() {
  return {
    storage: { mode: storageMode, database: storageMode === "mysql" ? DB_NAME : null },
    boards: state.mapBoards,
    accessPoints: state.accessPoints,
    wifiFingerprints: state.wifiFingerprints || [],
    obstacles: state.obstacles || [],
    destinationOverrides: state.destinationOverrides || {},
    storeDirectory,
    areaExitDirectory,
    sessions: Object.values(state.sessions).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    events: state.events.slice(-150).reverse(),
    sources: mapSources,
    learned: {
      nodes: Object.keys(state.learnedNodes || {}).length,
      edges: (state.learnedEdges || []).length,
      recentEdges: (state.learnedEdges || []).slice(-50).reverse()
    }
  };
}

function updateBoard(body) {
  const id = clean(body.id, 80);
  if (!id) return jsonError(400, "Board id is required.");
  const board = {
    id,
    nameZh: clean(body.nameZh, 120) || id,
    nameEn: clean(body.nameEn, 120) || id,
    floor: floors[body.floor] ? body.floor : "campus",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    heading: clamp(body.heading, 0, 359, 0),
    referenceHash: clean(body.referenceHash, 512),
    note: clean(body.note, 400)
  };
  const index = state.mapBoards.findIndex(item => item.id === id);
  if (index >= 0) state.mapBoards[index] = board;
  else state.mapBoards.push(board);
  void saveState();
  return jsonOk({ board, boards: state.mapBoards });
}

function updateAccessPoint(body) {
  const id = clean(body.id, 80);
  if (!id) return jsonError(400, "Access point id is required.");
  const ap = {
    id,
    name: clean(body.name, 120) || id,
    ip: clean(body.ip, 80),
    ssid: clean(body.ssid, 80),
    floor: floors[body.floor] ? body.floor : "campus",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    note: clean(body.note, 400)
  };
  const index = state.accessPoints.findIndex(item => item.id === id);
  if (index >= 0) state.accessPoints[index] = ap;
  else state.accessPoints.push(ap);
  void saveState();
  return jsonOk({ accessPoint: ap, accessPoints: state.accessPoints });
}

function updateDestination(body) {
  const allPlaces = resolvedPlaces();
  const id = clean(body.id, 120);
  if (!id || !allPlaces[id]) return jsonError(400, "Known destination id is required.");
  const base = places[id];
  const current = allPlaces[id];
  const aliases = Array.isArray(body.aliases)
    ? body.aliases.map(item => clean(item, 80)).filter(Boolean).slice(0, 30)
    : current.aliases || [];
  const node = graphNodes[body.node] ? body.node : current.node;
  const destination = {
    labelZh: clean(body.labelZh, 160) || current.labelZh || base.labelZh,
    labelEn: clean(body.labelEn, 160) || current.labelEn || base.labelEn,
    category: destinationCategories.some(categoryItem => categoryItem.id === body.category) ? body.category : current.category,
    floor: floors[body.floor] ? body.floor : current.floor || "campus",
    x: clamp(body.x, 0, CANVAS_WIDTH, current.x),
    y: clamp(body.y, 0, CANVAS_HEIGHT, current.y),
    node,
    aliases,
    updatedAt: new Date().toISOString()
  };
  if (current.shopNo) destination.shopNo = current.shopNo;
  if (current.storeNameZh) destination.storeNameZh = current.storeNameZh;
  if (current.storeNameEn) destination.storeNameEn = current.storeNameEn;
  if (current.exitCode) destination.exitCode = current.exitCode;
  if (current.area) destination.area = current.area;
  state.destinationOverrides[id] = destination;
  void saveState();
  return jsonOk({ destination: { id, ...destination }, places: resolvedPlaces() });
}

function saveParking(body, req) {
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  const parking = {
    id: randomUUID(),
    sessionId,
    floor: floors[body.floor] ? body.floor : "campus",
    x: clamp(body.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(body.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    note: clean(body.note, 180),
    at: new Date().toISOString()
  };
  state.parkingRecords = [parking, ...(state.parkingRecords || []).filter(item => item.sessionId !== sessionId)].slice(0, 300);
  recordSession(sessionId, "parking-save", { parking, clientIp: clientIp(req) });
  void saveParkingRecord(parking);
  void saveState();
  return jsonOk({ parking });
}

async function saveParkingRecord(parking) {
  if (storageMode !== "mysql" || !dbPool) return;
  try {
    await dbPool.query(
      "INSERT INTO parking_records (id, session_id, floor_id, x, y, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [parking.id, parking.sessionId, parking.floor, parking.x, parking.y, parking.note || null, parking.at.replace("T", " ").replace("Z", "")]
    );
  } catch (error) {
    console.warn("[storage] Failed to write parking record:", error.message);
  }
}

function latestParking(bodyOrQuery) {
  const sessionId = clean(bodyOrQuery.sessionId, 80);
  const parking = (state.parkingRecords || []).find(item => item.sessionId === sessionId);
  if (!parking) return jsonError(404, "No parking location saved.");
  return jsonOk({ parking });
}

function history(query) {
  const sessionId = clean(query.sessionId, 80);
  const events = state.events
    .filter(event => !sessionId || event.sessionId === sessionId)
    .slice(-30)
    .reverse();
  return jsonOk({ events });
}

function imageSearch(body, req) {
  const hint = normalizeSearch(`${body.hint || ""} ${body.fileName || ""}`);
  const rules = [
    { keys: ["parking", "park", "車", "停車"], detected: { id: "parking_sign", labelZh: "停車場標誌", labelEn: "Parking sign" }, query: "南側出口" },
    { keys: ["restroom", "toilet", "wc", "廁所"], detected: { id: "restroom_sign", labelZh: "廁所標誌", labelEn: "Restroom sign" }, query: "廁所" },
    { keys: ["elevator", "lift", "電梯"], detected: { id: "elevator_sign", labelZh: "電梯標誌", labelEn: "Elevator sign" }, query: "行政" },
    { keys: ["restaurant", "food", "餐", "食"], detected: { id: "restaurant_sign", labelZh: "餐飲標誌", labelEn: "Restaurant sign" }, query: "活動中心" },
    { keys: ["exit", "出口"], detected: { id: "exit_sign", labelZh: "出口標誌", labelEn: "Exit sign" }, query: "出口" },
    { keys: ["map", "campus", "校園", "地圖"], detected: { id: "campus_map", labelZh: "校園地圖看板", labelEn: "Campus map" }, query: "大門" },
    { keys: ["arcade", "game", "遊戲", "gachapon", "扭蛋"], detected: { id: "arcade_machine", labelZh: "遊戲機 / 扭蛋機", labelEn: "Arcade or gachapon" }, query: "活動中心" }
  ];
  const match = rules.find(rule => rule.keys.some(key => hint.includes(normalizeSearch(key)))) || rules[5];
  const resolved = resolveDestination({ query: match.query });
  if (resolved.status !== 200) return resolved;
  const destination = resolved.data.best;
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  recordSession(sessionId, "image-search", { detected: match.detected, destination: destination.id, clientIp: clientIp(req) });
  return jsonOk({ detected: match.detected, destination });
}

function config() {
  return {
    storage: { mode: storageMode, database: storageMode === "mysql" ? DB_NAME : null },
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    floors,
    places: resolvedPlaces(),
    destinationCategories,
    storeDirectory,
    areaExitDirectory,
    graphNodes,
    graphEdges,
    obstacles: activeObstacles("campus"),
    mapBoards: state.mapBoards,
    accessPoints: state.accessPoints,
    wifiFingerprints: state.wifiFingerprints || [],
    sources: mapSources,
    geoMapBounds: GEO_MAP_BOUNDS,
    baseMap: {
      type: "official-raster",
      image: "/assets/tamkang-campus-map.png",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      sourceWidth: 5670,
      sourceHeight: 5670,
      nameZh: "淡江大學淡水校園正式平面圖",
      nameEn: "Official Tamkang Tamsui Campus Plan"
    },
    referenceMaps: [
      { id: "walk", labelZh: "淡水校園人行路線圖", labelEn: "Tamsui Campus Walking Route Map", image: "/assets/tamkang-walk-route-map.png" },
      { id: "parking", labelZh: "淡江校園停車場位置圖", labelEn: "Tamkang Campus Parking Map", image: "/assets/tamkang-parking-map.png" }
    ]
  };
}

function login(body) {
  const password = clean(body.password, 200);
  if (!safeEqual(hash(password), hash(ADMIN_PASSWORD))) return jsonError(401, "Invalid password.");
  return jsonOk({ ok: true, token: ADMIN_TOKEN });
}

function isAdmin(req) {
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)admin_token=([^;]+)/);
  return Boolean(match && safeEqual(match[1], ADMIN_TOKEN));
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  sendJson(res, 401, { error: "Admin login required." });
  return false;
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest();
}

function safeEqual(a, b) {
  const left = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const right = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function clientIp(req) {
  const forwarded = clean(req.headers["x-forwarded-for"], 160);
  return forwarded.split(",")[0] || req.socket.remoteAddress || "";
}

function clean(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function jsonOk(data) {
  return { status: 200, data };
}

function jsonError(status, message) {
  return { status, data: { error: message } };
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid JSON body.")); }
    });
  });
}

function typeFor(filePath) {
  return { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml" }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function serveStatic(res, pathname) {
  let safePath = pathname;
  if (pathname === "/") safePath = "/index.html";
  if (pathname === "/admin") safePath = "/admin.html";
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": typeFor(filePath), "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

await loadState();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true, message: "Tamkang campus Wi-Fi navigation server is running.", port: PORT, storage: storageMode });
    if (req.method === "GET" && url.pathname === "/api/config") return sendJson(res, 200, config());
      if (req.method === "POST" && url.pathname === "/api/location/motion") {
        const result = learnGpsLocation(await readJson(req), req);
        return sendJson(res, result.status, result.data);
      }
    if (req.method === "POST" && url.pathname === "/api/route") {
      const result = route(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/location/wifi") {
      const result = locateByWifi(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/parking/save") {
      const result = saveParking(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "GET" && url.pathname === "/api/parking/latest") {
      const result = latestParking(Object.fromEntries(url.searchParams));
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "GET" && url.pathname === "/api/history") {
      const result = history(Object.fromEntries(url.searchParams));
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/image-search") {
      const result = imageSearch(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/destination/resolve") {
      const result = resolveDestination(await readJson(req));
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const result = login(await readJson(req));
      const headers = result.status === 200 ? { "Set-Cookie": `admin_token=${ADMIN_TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` } : {};
      return sendJson(res, result.status, result.data, headers);
    }
    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": "admin_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (!requireAdmin(req, res)) return;
      if (req.method === "GET" && url.pathname === "/api/admin/summary") return sendJson(res, 200, adminSummary());
      if (req.method === "POST" && url.pathname === "/api/admin/boards") {
        const result = updateBoard(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/access-points") {
        const result = updateAccessPoint(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/destinations") {
        const result = updateDestination(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
      if (req.method === "POST" && url.pathname === "/api/admin/wifi-fingerprints") {
        const result = updateWifiFingerprint(await readJson(req));
        return sendJson(res, result.status, result.data);
      }
    }
    if (req.method === "GET") return serveStatic(res, url.pathname);
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

function listen(port, attemptsLeft = 10) {
  server.once("error", error => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
  server.listen(port, () => {
    const actualPort = server.address().port;
    console.log(`Server running at http://localhost:${actualPort}`);
    console.log(`User app: http://localhost:${actualPort}/`);
    console.log(`Admin app: http://localhost:${actualPort}/admin`);
    if (!process.env.ADMIN_PASSWORD) console.log("Default admin password: TaipeiStationAdmin2026!");
  });
}

listen(PORT);
