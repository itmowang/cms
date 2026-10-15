export interface Channel {
  id: number;
  /** URL 目录名，例如 jiachang -> /jiachang/ */
  slug: string;
  name: string;
  description: string;
  keywords: string;
  sort: number;
  /** 是否在顶部导航显示 */
  showInNav: boolean;
  /** 分类图标（emoji），用于无封面图时的占位 */
  icon?: string;
}

export type ArticleStatus = "draft" | "published";

export type Difficulty = "简单" | "中等" | "较难";

export interface Ingredient {
  name: string;
  /** 用量，如 "300克"、"2个"、"适量" */
  amount: string;
}

/** 菜谱结构化信息：用于页面展示、schema.org Recipe 结构化数据、AI 抓取 */
export interface RecipeInfo {
  difficulty: Difficulty;
  /** 准备时间（分钟） */
  prepMinutes: number;
  /** 烹饪时间（分钟） */
  cookMinutes: number;
  /** 份量，如 "2人份"、"8块" */
  servings: string;
  /** 口味，如 "咸鲜"、"酸甜" */
  flavor?: string;
  ingredients: Ingredient[];
  /** 做法步骤，每项一步 */
  steps: string[];
  /** 小贴士 */
  tips?: string;
}

export interface Article {
  id: number;
  channelId: number;
  title: string;
  /** 短标题，用于首页密集列表 */
  shortTitle?: string;
  summary: string;
  /** Markdown 正文（菜谱的介绍、故事、延伸做法等） */
  content: string;
  cover?: string;
  author: string;
  source: string;
  tags: string[];
  /** 首页推荐 */
  isHeadline: boolean;
  /** 焦点图 */
  isFocus: boolean;
  status: ArticleStatus;
  views: number;
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
  /** 菜谱信息；普通文章（如美食资讯、厨房知识）可不填 */
  recipe?: RecipeInfo;
}

export interface FriendLink {
  name: string;
  url: string;
}

export interface SiteSettings {
  name: string;
  /** 首页 title 后缀/副标题 */
  slogan: string;
  description: string;
  keywords: string;
  logoText: string;
  icp: string;
  copyright: string;
  friendLinks: FriendLink[];
}

/** 旧版 db.json / db/seed.json 的结构（由 db/migrate.sh 导入 PostgreSQL） */
export interface Database {
  settings: SiteSettings;
  channels: Channel[];
  articles: Article[];
  seq: { channel: number; article: number };
}
