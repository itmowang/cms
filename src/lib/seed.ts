import type { Channel, Database } from "./types";

/**
 * 首次启动时的初始数据：只有站点设置和菜谱分类，不含任何文章。
 * 菜谱请在后台或通过 MCP 发布。
 */
const channelSeeds: Array<Omit<Channel, "id" | "sort" | "showInNav">> = [
  { slug: "jiachang", name: "家常菜", icon: "🍳", description: "下饭家常菜做法大全，步骤详细，新手也能一次做成功。", keywords: "家常菜,家常菜做法,下饭菜,炒菜,家常菜谱" },
  { slug: "hongbei", name: "烘焙", icon: "🍞", description: "蛋糕、面包、饼干烘焙教程，配方精确到克，烤箱新手入门必看。", keywords: "烘焙,烘焙教程,蛋糕做法,面包做法,饼干" },
  { slug: "tianpin", name: "甜品", icon: "🍰", description: "糖水、布丁、中式点心等甜品做法，颜值和美味兼得。", keywords: "甜品,甜品做法,糖水,布丁,下午茶甜点" },
  { slug: "tang", name: "汤羹", icon: "🍲", description: "家常汤品与炖汤做法，鲜美滋补，一碗暖胃又暖心。", keywords: "汤,煲汤,汤的做法,家常汤,炖汤" },
  { slug: "zaocan", name: "早餐", icon: "🥞", description: "快手营养早餐做法，15 分钟搞定一顿元气满满的早饭。", keywords: "早餐,早餐做法,快手早餐,营养早餐,早饭" },
  { slug: "mianshi", name: "面食", icon: "🍜", description: "面条、饺子、包子等面食做法，从和面到成品手把手教。", keywords: "面食,面条做法,饺子,包子,面食做法" },
  { slug: "xiaochi", name: "小吃", icon: "🍢", description: "街头小吃、凉菜和零嘴做法，追剧聚会必备。", keywords: "小吃,小吃做法,凉菜,零食,街头小吃" },
  { slug: "yinpin", name: "饮品", icon: "🥤", description: "奶茶、果茶、奶昔、养生茶饮做法，在家也能喝到店里的味道。", keywords: "饮品,奶茶做法,果茶,奶昔,自制饮品" },
];

export function createSeed(): Database {
  const channels: Channel[] = channelSeeds.map((c, i) => ({ ...c, id: i + 1, sort: i + 1, showInNav: true }));
  return {
    settings: {
      name: "粉厨美食",
      slogan: "跟着做，家常美味零失败",
      description: "粉厨美食是美食制作教程分享网站，提供家常菜、烘焙、甜品、汤羹、早餐、面食、小吃、饮品等菜谱做法，每一步都清清楚楚。",
      keywords: "菜谱,美食教程,家常菜做法,烘焙,甜品,美食分享",
      logoText: "粉厨美食",
      icp: "",
      copyright: "粉厨美食 版权所有",
      friendLinks: [],
    },
    channels,
    articles: [],
    seq: { channel: channels.length, article: 0 },
  };
}
