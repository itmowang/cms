export interface Channel {
  id: number;
  /** URL 目录名，例如 news -> /news/ */
  slug: string;
  name: string;
  description: string;
  keywords: string;
  sort: number;
  /** 是否在顶部导航显示 */
  showInNav: boolean;
}

export type ArticleStatus = "draft" | "published";

export interface Article {
  id: number;
  channelId: number;
  title: string;
  /** 短标题，用于首页密集列表 */
  shortTitle?: string;
  summary: string;
  /** Markdown 正文 */
  content: string;
  cover?: string;
  author: string;
  source: string;
  tags: string[];
  /** 头条 */
  isHeadline: boolean;
  /** 焦点图 */
  isFocus: boolean;
  status: ArticleStatus;
  views: number;
  publishedAt: string;
  updatedAt: string;
  createdAt: string;
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

export interface Database {
  settings: SiteSettings;
  channels: Channel[];
  articles: Article[];
  seq: { channel: number; article: number };
}
