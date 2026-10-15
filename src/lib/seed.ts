import type { Article, Channel, Database } from "./types";

/** 首次启动时生成的演示数据，全部为虚构内容 */
const channelSeeds: Array<Omit<Channel, "id" | "sort" | "showInNav"> & { titles: string[]; tags: string[] }> = [
  {
    slug: "news",
    name: "新闻",
    description: "国内国际要闻、社会热点，第一时间权威发布。",
    keywords: "新闻,要闻,国内新闻,国际新闻,社会热点",
    tags: ["要闻", "民生", "社会", "国际"],
    titles: [
      "多地推出便民服务新举措 政务办理实现“一网通办”",
      "城市更新行动持续推进 老旧小区改造惠及百万居民",
      "秋季旅游市场升温 文旅消费呈现多元化趋势",
      "全国铁路迎来客流高峰 多条线路加开夜间列车",
      "社区养老服务网络加快织密 “家门口”养老成现实",
      "新一批基础设施项目集中开工 总投资超千亿元",
      "多地气象部门发布降温预报 提醒公众注意防寒",
      "全民健身活动蓬勃开展 城市运动空间不断扩容",
    ],
  },
  {
    slug: "finance",
    name: "财经",
    description: "宏观经济、金融市场、产业动态深度解读。",
    keywords: "财经,股市,基金,宏观经济,理财",
    tags: ["宏观", "股市", "理财", "产业"],
    titles: [
      "前三季度经济运行稳中有进 消费对增长贡献提升",
      "A股三大指数集体收涨 科技板块领涨两市",
      "多家银行下调存款利率 理财产品收益率走势分析",
      "制造业PMI连续回升 企业生产经营预期向好",
      "新能源产业链持续扩张 上游原材料价格趋稳",
      "跨境电商进出口规模创新高 外贸新业态动能强劲",
      "居民储蓄意愿变化观察：年轻人更偏爱稳健理财",
      "专家解读：如何看待当前市场流动性环境",
    ],
  },
  {
    slug: "tech",
    name: "科技",
    description: "互联网、人工智能、数码产品前沿资讯。",
    keywords: "科技,互联网,人工智能,AI,数码,手机",
    tags: ["人工智能", "互联网", "数码", "芯片"],
    titles: [
      "大模型应用加速落地 智能客服成企业降本新选择",
      "国产芯片研发再获突破 新一代处理器能效提升显著",
      "折叠屏手机市场竞争加剧 价格下探至中端区间",
      "AI编程助手走红 开发者工作方式迎来变革",
      "卫星互联网建设提速 偏远地区通信条件改善",
      "智能家居生态加速融合 跨品牌互联成行业共识",
      "数据安全新规实施 企业合规建设进入快车道",
      "量子计算科普：它与传统计算机有何不同",
    ],
  },
  {
    slug: "sports",
    name: "体育",
    description: "足球、篮球、综合体育赛事报道与评论。",
    keywords: "体育,足球,篮球,赛事,中超,CBA",
    tags: ["足球", "篮球", "赛事", "全民健身"],
    titles: [
      "联赛第28轮综述：榜首球队客场取胜扩大领先优势",
      "篮球新赛季开幕在即 各队引援情况盘点",
      "城市马拉松报名火爆 三万名额半天告罄",
      "青少年足球培训体系逐步完善 校园足球普及率提升",
      "乒乓球公开赛落幕 年轻选手表现亮眼",
      "冬季运动项目进校园 冰雪运动人口持续增长",
      "电竞赛事观赛人数创纪录 行业规范化发展提速",
      "专访某俱乐部主教练：球队目标是稳定前四",
    ],
  },
  {
    slug: "ent",
    name: "娱乐",
    description: "影视、综艺、音乐娱乐资讯。",
    keywords: "娱乐,电影,电视剧,综艺,音乐",
    tags: ["电影", "剧集", "综艺", "音乐"],
    titles: [
      "国庆档电影票房盘点 多部现实题材影片口碑走高",
      "年代剧热播引发怀旧潮 细节还原获观众点赞",
      "音乐节市场持续火热 小众乐队迎来更多舞台",
      "微短剧行业迎来规范化 精品化成发展方向",
      "纪录片《山河之间》开播 展现自然生态之美",
      "综艺节目创新求变 慢综艺重新受到关注",
      "传统戏曲搭上短视频快车 年轻观众数量增长",
      "动画电影市场观察：国产IP如何突围",
    ],
  },
  {
    slug: "auto",
    name: "汽车",
    description: "新车发布、行业动态、用车指南。",
    keywords: "汽车,新能源汽车,新车,用车,评测",
    tags: ["新能源", "新车", "用车", "评测"],
    titles: [
      "新能源汽车渗透率再创新高 充电设施建设同步提速",
      "多款新车集中上市 智能驾驶配置成标配",
      "冬季用车指南：电动车续航衰减怎么应对",
      "二手车市场交易活跃 新能源二手车保值率受关注",
      "固态电池量产进程观察 距离普及还有多远",
      "城市NOA功能开放城市扩容 实测体验如何",
      "家用SUV选购攻略：空间、油耗与安全怎么平衡",
      "汽车出口量持续增长 自主品牌海外布局加速",
    ],
  },
  {
    slug: "house",
    name: "房产",
    description: "楼市动态、政策解读、置业指南。",
    keywords: "房产,楼市,买房,房价,装修",
    tags: ["楼市", "政策", "置业", "家居"],
    titles: [
      "多城优化住房公积金政策 首套房贷款额度提高",
      "保障性住房建设提速 新市民住房需求获支持",
      "改善型需求释放 大户型产品成交占比上升",
      "二手房带看量回升 业内分析市场趋势",
      "装修避坑指南：签合同前务必确认这几点",
      "绿色建筑标准推广 住宅品质迎来升级",
      "租房市场观察：长租公寓服务更加规范",
      "专家谈楼市：理性看待短期波动",
    ],
  },
  {
    slug: "edu",
    name: "教育",
    description: "升学考试、教育政策、校园资讯。",
    keywords: "教育,高考,考研,升学,留学",
    tags: ["高考", "考研", "职业教育", "家庭教育"],
    titles: [
      "考研报名即将开始 今年报考呈现哪些新特点",
      "职业教育产教融合深化 毕业生就业率保持高位",
      "中小学课后服务提质 兴趣课程更加丰富",
      "高校新增一批本科专业 人工智能相关专业受热捧",
      "家庭教育促进：如何与青春期孩子有效沟通",
      "研学旅行市场规范发展 安全与质量成关注焦点",
      "终身学习渐成风尚 老年大学“一座难求”",
      "留学趋势观察：更多学生选择多元目的地",
    ],
  },
];

function buildContent(title: string, channelName: string, tags: string[]): string {
  return `${title}，这一话题近期引发广泛关注。记者通过走访调查、查阅资料等方式，梳理了相关情况。

## 背景情况

据了解，近年来${channelName}领域持续发展，相关政策和市场环境不断完善。业内人士表示，${tags[0]}方面的变化，正在深刻影响着行业格局与公众生活。

## 各方观点

多位受访者表示，相关举措落地后，实际效果明显。一位从业者说：“我们能感受到变化正在发生，未来值得期待。”

也有专家提醒，在快速发展的同时，仍需关注以下几点：

1. 加强规范引导，保障各方合法权益；
2. 注重长期效果，避免“一阵风”式推进；
3. 及时总结经验，形成可复制推广的模式。

## 下一步展望

业内普遍认为，随着各项工作持续推进，${tags[1] ?? channelName}相关领域有望迎来新的发展机遇。本网将持续关注后续进展。

> 本文为演示数据，内容均为虚构，仅用于展示 CMS 功能。`;
}

export function createSeed(): Database {
  const now = Date.now();
  const channels: Channel[] = [];
  const articles: Article[] = [];
  let articleId = 0;

  channelSeeds.forEach((c, ci) => {
    const channel: Channel = {
      id: ci + 1,
      slug: c.slug,
      name: c.name,
      description: c.description,
      keywords: c.keywords,
      sort: ci + 1,
      showInNav: true,
    };
    channels.push(channel);

    c.titles.forEach((title, ti) => {
      articleId += 1;
      // 让发布时间错开，便于排序展示
      const published = new Date(now - (ti * channelSeeds.length + ci) * 47 * 60 * 1000).toISOString();
      articles.push({
        id: articleId,
        channelId: channel.id,
        title,
        shortTitle: title.length > 18 ? title.split(/[ ：:]/)[0] : undefined,
        summary: `${title}。本文梳理了事件背景、各方观点与后续展望，帮助读者快速了解${c.name}领域最新动态。`,
        content: buildContent(title, c.name, c.tags),
        author: "本网记者",
        source: "门户网",
        tags: [c.tags[ti % c.tags.length], c.tags[(ti + 1) % c.tags.length]],
        isHeadline: ti === 0 && ci < 3,
        isFocus: ti === 1 && ci < 5,
        status: "published",
        views: Math.floor(((ti * 7 + ci * 13) % 50) * 137 + 100),
        publishedAt: published,
        updatedAt: published,
        createdAt: published,
      });
    });
  });

  return {
    settings: {
      name: "门户网",
      slogan: "权威资讯 · 第一时间",
      description: "门户网是综合性新闻资讯门户，提供新闻、财经、科技、体育、娱乐、汽车、房产、教育等频道的权威资讯。",
      keywords: "门户网,新闻,资讯,财经,科技,体育,娱乐",
      logoText: "门户网",
      icp: "京ICP备00000000号",
      copyright: "门户网 版权所有",
      friendLinks: [
        { name: "Next.js", url: "https://nextjs.org" },
        { name: "百度站长平台", url: "https://ziyuan.baidu.com" },
      ],
    },
    channels,
    articles,
    seq: { channel: channels.length, article: articleId },
  };
}
