import http from "http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TaipeiStationAdmin2026!";
const ADMIN_TOKEN = randomBytes(32).toString("hex");
const CANVAS_WIDTH = 1100;
const CANVAS_HEIGHT = 720;
const METERS_PER_PIXEL = 0.6;

const floors = {
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
    { id: "M-B1-CENTER-01", nameZh: "M \u5340\u4e2d\u592e\u7246\u9762\u5730\u5716", nameEn: "M Area Center Wall Map", floor: "B1", x: 545, y: 360, heading: 0, referenceHash: "", note: "\u53f0\u5317\u8eca\u7ad9\u5730\u4e0b\u8857 M \u5340\u4e2d\u592e" },
    { id: "M-B1-EAST-01", nameZh: "M3/M7 \u65b9\u5411\u7246\u9762\u5730\u5716", nameEn: "M3/M7 Side Wall Map", floor: "B1", x: 745, y: 350, heading: 270, referenceHash: "", note: "\u9760\u8fd1 M3/M7 \u65b9\u5411" },
    { id: "M-B1-SOUTH-01", nameZh: "\u7ad9\u524d\u5730\u4e0b\u8857\u9023\u901a\u5730\u5716", nameEn: "Station Front Link Wall Map", floor: "B1", x: 555, y: 535, heading: 180, referenceHash: "", note: "\u901a\u5f80 Z \u5340 / \u7ad9\u524d\u5730\u4e0b\u8857" },
    { id: "M-B1-WEST-01", nameZh: "Y \u5340\u65b9\u5411\u7246\u9762\u5730\u5716", nameEn: "Y Area Side Wall Map", floor: "B1", x: 245, y: 355, heading: 90, referenceHash: "", note: "\u901a\u5f80\u53f0\u5317\u5730\u4e0b\u8857 Y \u5340" }
  ],
  accessPoints: [
    { id: "AP-M-CENTER", name: "M Area Wi-Fi AP Center", ip: "10.10.20.11", ssid: "TPE-Free", floor: "B1", x: 545, y: 360, note: "Demo data. Replace with real AP inventory." },
    { id: "AP-M-EAST", name: "M Area Wi-Fi AP East", ip: "10.10.20.12", ssid: "TPE-Free", floor: "B1", x: 745, y: 350, note: "Demo data. Replace with real AP inventory." }
  ],
  sessions: {},
  events: [],
  learnedNodes: {},
  learnedEdges: [],
  lastPositions: {}
};

let state = structuredClone(defaultState);

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

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function buildAdjacency(nodes = graphNodes, edges = graphEdges) {
  const out = Object.fromEntries(Object.keys(nodes).map(key => [key, []]));
  for (const [a, b] of edges) {
    if (!nodes[a] || !nodes[b] || !out[a] || !out[b]) continue;
    const weight = distance(nodes[a], nodes[b]);
    out[a].push({ node: b, weight });
    out[b].push({ node: a, weight });
  }
  return out;
}

const adjacency = buildAdjacency();

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(dataFile, "utf8"));
    state = {
      ...structuredClone(defaultState),
      ...saved,
      mapBoards: migrateBoards(saved.mapBoards),
      accessPoints: Array.isArray(saved.accessPoints) ? saved.accessPoints : structuredClone(defaultState.accessPoints),
      sessions: saved.sessions && typeof saved.sessions === "object" ? saved.sessions : {},
      events: Array.isArray(saved.events) ? saved.events : [],
      learnedNodes: saved.learnedNodes && typeof saved.learnedNodes === "object" ? saved.learnedNodes : {},
      learnedEdges: Array.isArray(saved.learnedEdges) ? saved.learnedEdges : [],
      lastPositions: saved.lastPositions && typeof saved.lastPositions === "object" ? saved.lastPositions : {}
    };
  } catch {
    await saveState();
  }
}

function migrateBoards(boards) {
  if (!Array.isArray(boards) || boards.length === 0) return structuredClone(defaultState.mapBoards);
  const oldDemoData = boards.some(board => ["B-WEST-01", "B-CENTER-01", "B-EAST-01", "A-CENTER-01", "C-CENTER-01"].includes(board.id));
  if (oldDemoData) return structuredClone(defaultState.mapBoards);
  return boards.map(board => ({
    id: clean(board.id, 80) || randomUUID(),
    nameZh: clean(board.nameZh || board.name, 120) || clean(board.id, 80),
    nameEn: clean(board.nameEn || board.name, 120) || clean(board.id, 80),
    floor: floors[board.floor] ? board.floor : "B1",
    x: clamp(board.x, 0, CANVAS_WIDTH, CANVAS_WIDTH / 2),
    y: clamp(board.y, 0, CANVAS_HEIGHT, CANVAS_HEIGHT / 2),
    heading: clamp(board.heading, 0, 359, 0),
    referenceHash: clean(board.referenceHash, 512),
    note: clean(board.note, 400)
  }));
}

async function saveState() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify({
    mapBoards: state.mapBoards,
    accessPoints: state.accessPoints,
    sessions: state.sessions,
    events: state.events.slice(-800),
    learnedNodes: state.learnedNodes,
    learnedEdges: state.learnedEdges.slice(-2000),
    lastPositions: state.lastPositions
  }, null, 2), "utf8");
}

function learnedNodeId(point) {
  const x = Math.round(Number(point.x) / 18) * 18;
  const y = Math.round(Number(point.y) / 18) * 18;
  const floor = floors[point.floor] ? point.floor : "B1";
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
    out.push([edge.a, edge.b]);
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
      floor: node.floor || "B1",
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

function shortestPath(startKey, endKey, nodes = graphNodes, adj = adjacency) {
  const distances = {};
  const previous = {};
  const open = new Set(Object.keys(nodes));
  for (const key of open) {
    distances[key] = Infinity;
    previous[key] = null;
  }
  distances[startKey] = 0;
  while (open.size > 0) {
    let current = null;
    for (const key of open) {
      if (current === null || distances[key] < distances[current]) current = key;
    }
    if (!current || distances[current] === Infinity || current === endKey) break;
    open.delete(current);
    for (const edge of adjacency[current]) {
      if (!open.has(edge.node)) continue;
      const alternative = distances[current] + edge.weight;
      if (alternative < distances[edge.node]) {
        distances[edge.node] = alternative;
        previous[edge.node] = current;
      }
    }
  }
  const pathKeys = [];
  let cursor = endKey;
  while (cursor) {
    pathKeys.unshift(cursor);
    cursor = previous[cursor];
  }
  if (pathKeys[0] !== startKey) return { pathKeys: [], totalDistance: Infinity };
  return { pathKeys, totalDistance: distances[endKey] };
}

function hamming(a = "", b = "") {
  const len = Math.min(a.length, b.length);
  if (!len) return Infinity;
  let diff = Math.abs(a.length - b.length);
  for (let i = 0; i < len; i += 1) if (a[i] !== b[i]) diff += 1;
  return diff;
}

function locateByPhoto(body, req) {
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  const photoHash = clean(body.photoHash, 512);
  const hintedFloor = floors[body.floor] ? body.floor : "";
  const candidates = state.mapBoards
    .filter(board => !hintedFloor || board.floor === hintedFloor)
    .map(board => {
      const hasHash = Boolean(board.referenceHash && photoHash);
      const diff = hasHash ? hamming(photoHash, board.referenceHash) : 999;
      const hashScore = hasHash ? Math.max(0, 1 - diff / Math.max(photoHash.length, board.referenceHash.length)) : 0;
      const score = Math.min(1, hashScore + (hintedFloor === board.floor ? 0.08 : 0));
      return { board, diff, score, method: hasHash ? "photo-hash" : "floor-fallback" };
    })
    .sort((a, b) => b.score - a.score || a.diff - b.diff);
  const best = candidates[0];
  if (!best) return jsonError(404, "No registered wall maps.");
  const confidence = Number(best.score.toFixed(3));
  const usable = (best.method === "photo-hash" && confidence >= 0.72) || (best.method === "floor-fallback" && hintedFloor);
  if (!usable) return jsonError(422, "Photo does not match a calibrated wall map. Please calibrate it in admin first.");
  const location = {
    source: best.method,
    confidence,
    boardId: best.board.id,
    boardNameZh: best.board.nameZh,
    boardNameEn: best.board.nameEn,
    floor: best.board.floor,
    x: Number(best.board.x),
    y: Number(best.board.y),
    heading: Number(best.board.heading || 0),
    accessPoint: nearestAccessPoint(best.board)
  };
  recordSession(sessionId, "photo-location", { location, clientIp: clientIp(req), userAgent: clean(body.userAgent, 180) });
  return jsonOk({ sessionId, location, candidates: candidates.slice(0, 5).map(item => ({
    id: item.board.id,
    nameZh: item.board.nameZh,
    nameEn: item.board.nameEn,
    floor: item.board.floor,
    confidence: Number(item.score.toFixed(3)),
    hashDiff: item.diff,
    method: item.method
  })) });
}

function route(body, req) {
  const currentFloor = floors[body.currentFloor] ? body.currentFloor : "B1";
  const destFloor = floors[body.destFloor] ? body.destFloor : currentFloor;
  const destPlace = places[body.destPlace] ? body.destPlace : "M3";
  const position = { floor: currentFloor, x: Number(body.position?.x), y: Number(body.position?.y) };
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return jsonError(400, "position.x and position.y must be numbers.");
  const sameFloor = currentFloor === destFloor;
  const routeTarget = sameFloor ? destPlace : "elevator";
  const destination = places[routeTarget];
  const routing = learnedGraph();
  const adjacencyForRoute = buildAdjacency(routing.nodes, routing.edges);
  const snap = nearestNode(position, routing.nodes);
  const result = shortestPath(snap.key, destination.node, routing.nodes, adjacencyForRoute);
  const path = result.pathKeys.map(key => ({ id: key, ...routing.nodes[key] })).filter(item => Number.isFinite(item.x));
  const verticalDiff = floors[destFloor].order - floors[currentFloor].order;
  const verticalDirection = verticalDiff > 0 ? "down" : verticalDiff < 0 ? "up" : "same";
  const sessionId = clean(body.sessionId, 80);
  if (sessionId) recordSession(sessionId, "route", {
    currentFloor,
    destFloor,
    destPlace,
    position,
    accessPoint: nearestAccessPoint({ floor: currentFloor, x: position.x, y: position.y }),
    routeTarget,
    totalDistance: Math.round(result.totalDistance),
    totalMeters: Math.round(result.totalDistance * METERS_PER_PIXEL),
    clientIp: clientIp(req)
  });
  return jsonOk({
    currentFloor,
    destFloor,
    destPlace,
    routeTarget,
    sameFloor,
    verticalDirection,
    start: { x: position.x, y: position.y, nearestNode: snap.key, snapDistance: Math.round(snap.distance) },
    destination,
    path,
    pathKeys: result.pathKeys,
    totalDistance: Math.round(result.totalDistance),
    totalMeters: Math.round(result.totalDistance * METERS_PER_PIXEL),
    learnedEdges: state.learnedEdges.length,
    learnedNodes: Object.keys(state.learnedNodes).length
  });
}

function learnGpsLocation(body, req) {
  const sessionId = clean(body.sessionId, 80) || randomUUID();
  const floor = floors[body.floor] ? body.floor : "B1";
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
  recordSession(sessionId, "gps-location", {
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

function resolveDestination(body) {
  const query = normalizeSearch(body.query);
  if (!query) return jsonError(400, "query is required.");
  const candidates = Object.entries(places).map(([id, placeData]) => {
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
  state.events.push({ id: randomUUID(), sessionId, type, at, payload });
  state.events = state.events.slice(-800);
  void saveState();
}

function adminSummary() {
  return {
    boards: state.mapBoards,
    accessPoints: state.accessPoints,
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
    floor: floors[body.floor] ? body.floor : "B1",
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
    floor: floors[body.floor] ? body.floor : "B1",
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

function config() {
  return { canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }, floors, places, destinationCategories, storeDirectory, areaExitDirectory, graphNodes, graphEdges, mapBoards: state.mapBoards, accessPoints: state.accessPoints, sources: mapSources };
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
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { ok: true, message: "Taipei Station photo navigation server is running.", port: PORT });
    if (req.method === "GET" && url.pathname === "/api/config") return sendJson(res, 200, config());
      if (req.method === "POST" && url.pathname === "/api/location/gps") {
        const result = learnGpsLocation(await readJson(req), req);
        return sendJson(res, result.status, result.data);
      }
      if (req.method === "POST" && url.pathname === "/api/location/photo") {
      const result = locateByPhoto(await readJson(req), req);
      return sendJson(res, result.status, result.data);
    }
    if (req.method === "POST" && url.pathname === "/api/route") {
      const result = route(await readJson(req), req);
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
