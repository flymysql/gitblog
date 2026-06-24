/** 高考专业倾向测评 — 兴趣标签、问卷选项、专业库 */

export const INTEREST_OPTIONS = [
  { id: 'tech', label: '科技数码' },
  { id: 'logic', label: '数理逻辑' },
  { id: 'design', label: '创意设计' },
  { id: 'writing', label: '文字表达' },
  { id: 'social', label: '社会观察' },
  { id: 'business', label: '商业财经' },
  { id: 'medical', label: '医疗健康' },
  { id: 'education', label: '教育公益' },
  { id: 'law', label: '法律规则' },
  { id: 'nature', label: '自然环境' },
  { id: 'media', label: '表演传媒' },
  { id: 'hands', label: '动手实操' },
];

export const SKILL_DIMS = [
  { id: 'math', label: '数学与逻辑' },
  { id: 'writing', label: '语言表达' },
  { id: 'handsOn', label: '动手实验' },
  { id: 'art', label: '艺术审美' },
  { id: 'social', label: '人际沟通' },
  { id: 'focus', label: '长期专注' },
  { id: 'stress', label: '抗压能力' },
  { id: 'english', label: '英语/外语' },
];

export const DISCIPLINE_META = {
  工学: { hue: 12, icon: '工' },
  理学: { hue: 200, icon: '理' },
  医学: { hue: 340, icon: '医' },
  经济学: { hue: 45, icon: '经' },
  管理学: { hue: 28, icon: '管' },
  法学: { hue: 260, icon: '法' },
  文学: { hue: 310, icon: '文' },
  教育学: { hue: 160, icon: '教' },
  艺术学: { hue: 280, icon: '艺' },
  农学: { hue: 120, icon: '农' },
  历史学: { hue: 30, icon: '史' },
  哲学: { hue: 220, icon: '哲' },
};

/**
 * traits 0–10：logic math creativity social writing handsOn
 * income stability gradSchool abroad pressure publicService
 */
export const MAJORS = [
  { id: 'cs', name: '计算机科学与技术', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic'], traits: { logic: 9, math: 8, creativity: 6, social: 4, writing: 3, handsOn: 5, income: 9, stability: 6, gradSchool: 8, abroad: 8, pressure: 8, publicService: 3 }, careers: ['软件工程师', '算法工程师', '产品经理'], summary: '适合逻辑强、愿意持续学习新技术的学生。', cautions: '行业更新快，部分岗位加班较多，需终身学习。' },
  { id: 'software', name: '软件工程', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic', 'hands'], traits: { logic: 8, math: 7, creativity: 5, social: 5, writing: 4, handsOn: 7, income: 9, stability: 6, gradSchool: 6, abroad: 7, pressure: 7, publicService: 3 }, careers: ['软件开发', '测试开发', '项目经理'], summary: '偏工程实践，适合喜欢把想法做成可用产品的同学。', cautions: '项目节奏紧，团队协作能力很重要。' },
  { id: 'ai', name: '人工智能', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic'], traits: { logic: 10, math: 9, creativity: 6, social: 3, writing: 3, handsOn: 5, income: 9, stability: 5, gradSchool: 9, abroad: 9, pressure: 9, publicService: 2 }, careers: ['算法工程师', '研究员', 'AI 产品经理'], summary: '数学与编程要求高，适合肯钻研、能抗压的学生。', cautions: '竞争激烈，读研深造较常见，本科需打牢基础。' },
  { id: 'ee', name: '电子信息工程', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic', 'hands'], traits: { logic: 8, math: 8, creativity: 5, social: 4, writing: 3, handsOn: 7, income: 8, stability: 7, gradSchool: 7, abroad: 7, pressure: 7, publicService: 4 }, careers: ['硬件工程师', '通信工程师', '嵌入式开发'], summary: '软硬件结合，适合对电子、通信有兴趣的同学。', cautions: '实验与理论并重，部分方向学习曲线陡峭。' },
  { id: 'auto', name: '自动化', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic', 'hands'], traits: { logic: 8, math: 8, creativity: 4, social: 4, writing: 3, handsOn: 7, income: 8, stability: 7, gradSchool: 7, abroad: 6, pressure: 6, publicService: 5 }, careers: ['控制工程师', '机器人工程师', '智能制造'], summary: '数学与控制理论为核心，就业面较宽。', cautions: '部分课程抽象，需要耐心啃数学。' },
  { id: 'mechanical', name: '机械工程', discipline: '工学', needsPhysics: true, interestTags: ['hands', 'logic'], traits: { logic: 7, math: 7, creativity: 5, social: 4, writing: 3, handsOn: 9, income: 7, stability: 8, gradSchool: 5, abroad: 5, pressure: 5, publicService: 6 }, careers: ['机械设计', '制造工程师', '汽车工程'], summary: '动手能力强、喜欢实物结构的同学较适合。', cautions: '传统制造业起薪可能不如互联网，但稳定性较好。' },
  { id: 'civil', name: '土木工程', discipline: '工学', needsPhysics: true, interestTags: ['hands', 'nature'], traits: { logic: 7, math: 7, creativity: 4, social: 5, writing: 4, handsOn: 8, income: 7, stability: 7, gradSchool: 4, abroad: 4, pressure: 6, publicService: 6 }, careers: ['结构工程师', '造价工程师', '项目经理'], summary: '适合能接受现场工作、做事踏实的同学。', cautions: '部分岗位需跟项目流动，工作环境因方向而异。' },
  { id: 'architecture', name: '建筑学', discipline: '工学', needsPhysics: true, interestTags: ['design', 'hands'], traits: { logic: 6, math: 6, creativity: 9, social: 5, writing: 4, handsOn: 8, income: 7, stability: 6, gradSchool: 6, abroad: 7, pressure: 8, publicService: 4 }, careers: ['建筑师', '室内设计师', '城市规划'], summary: '设计与工程兼备，适合有审美又肯熬夜画图的同学。', cautions: '学制常达五年，课业与作业量较大。' },
  { id: 'chemical_eng', name: '化学工程与工艺', discipline: '工学', needsPhysics: true, needsSubjects: ['chemistry'], interestTags: ['logic', 'hands', 'nature'], traits: { logic: 7, math: 7, creativity: 4, social: 4, writing: 3, handsOn: 8, income: 7, stability: 8, gradSchool: 6, abroad: 6, pressure: 5, publicService: 5 }, careers: ['化工工程师', '材料研发', '工艺工程师'], summary: '化工、能源、材料行业基础专业，就业稳定。', cautions: '部分岗位在工厂一线，需关注工作环境。' },
  { id: 'environment', name: '环境工程', discipline: '工学', needsPhysics: true, interestTags: ['nature', 'social'], traits: { logic: 6, math: 6, creativity: 4, social: 5, writing: 5, handsOn: 7, income: 6, stability: 7, gradSchool: 6, abroad: 6, pressure: 5, publicService: 7 }, careers: ['环保工程师', '环评工程师', '生态修复'], summary: '适合关心环保、愿意做公共事务相关工作的同学。', cautions: '行业受政策影响较大，起薪中等。' },
  { id: 'math', name: '数学与应用数学', discipline: '理学', needsPhysics: true, interestTags: ['logic'], traits: { logic: 10, math: 10, creativity: 5, social: 3, writing: 4, handsOn: 2, income: 7, stability: 7, gradSchool: 9, abroad: 8, pressure: 7, publicService: 5 }, careers: ['数据分析', '量化金融', '教师/研究员'], summary: '基础学科，深造后出路更广，适合数学天赋突出者。', cautions: '本科直接就业面较窄，建议提前规划深造或转行方向。' },
  { id: 'physics', name: '物理学', discipline: '理学', needsPhysics: true, interestTags: ['logic', 'nature'], traits: { logic: 9, math: 9, creativity: 5, social: 3, writing: 4, handsOn: 5, income: 6, stability: 7, gradSchool: 9, abroad: 8, pressure: 6, publicService: 5 }, careers: ['科研', '半导体/光学', '教师'], summary: '适合对自然规律有强烈好奇心、能坐冷板凳的同学。', cautions: '本科就业需结合辅修或读研方向。' },
  { id: 'chemistry', name: '化学', discipline: '理学', needsPhysics: true, needsSubjects: ['chemistry'], interestTags: ['logic', 'hands', 'nature'], traits: { logic: 7, math: 7, creativity: 4, social: 3, writing: 4, handsOn: 8, income: 6, stability: 7, gradSchool: 8, abroad: 7, pressure: 5, publicService: 4 }, careers: ['化学分析', '材料研发', '医药研发'], summary: '实验较多，适合细心、喜欢动手做实验的同学。', cautions: '实验室工作需耐心，部分试剂有安全要求。' },
  { id: 'biology', name: '生物科学', discipline: '理学', needsPhysics: true, interestTags: ['nature', 'medical'], traits: { logic: 7, math: 6, creativity: 4, social: 4, writing: 5, handsOn: 8, income: 6, stability: 6, gradSchool: 9, abroad: 8, pressure: 5, publicService: 4 }, careers: ['生物医药研发', '检验检测', '科研'], summary: '生命科学基础专业，深造比例较高。', cautions: '本科对口岗位有限，建议尽早确定研究生方向。' },
  { id: 'statistics', name: '统计学', discipline: '理学', needsPhysics: true, interestTags: ['logic', 'business'], traits: { logic: 9, math: 9, creativity: 4, social: 4, writing: 4, handsOn: 3, income: 8, stability: 7, gradSchool: 8, abroad: 7, pressure: 6, publicService: 4 }, careers: ['数据分析师', '精算', '市场研究'], summary: '数据时代的基础专业，与互联网、金融结合紧密。', cautions: '需补充编程与业务知识，增强就业竞争力。' },
  { id: 'psychology', name: '心理学', discipline: '理学', interestTags: ['social', 'education'], traits: { logic: 6, math: 5, creativity: 5, social: 8, writing: 6, handsOn: 4, income: 6, stability: 6, gradSchool: 8, abroad: 7, pressure: 5, publicService: 6 }, careers: ['心理咨询', '人力资源', '用户研究'], summary: '适合善于倾听、对人类行为有兴趣的同学。', cautions: '执业心理咨询常需读研及规培，本科需积累实习。' },
  { id: 'clinical', name: '临床医学', discipline: '医学', needsPhysics: true, needsSubjects: ['chemistry', 'biology'], interestTags: ['medical', 'social'], traits: { logic: 8, math: 7, creativity: 3, social: 7, writing: 5, handsOn: 8, income: 8, stability: 9, gradSchool: 9, abroad: 6, pressure: 9, publicService: 8 }, careers: ['临床医生', '医学研究'], summary: '学制长、培养周期长，适合有奉献精神、能吃苦的同学。', cautions: '通常五年制及以上，规培与考研压力大，填报前需充分心理准备。' },
  { id: 'nursing', name: '护理学', discipline: '医学', interestTags: ['medical', 'social'], traits: { logic: 5, math: 4, creativity: 3, social: 8, writing: 4, handsOn: 8, income: 6, stability: 9, gradSchool: 5, abroad: 5, pressure: 7, publicService: 8 }, careers: ['护士', '社区护理', '健康管理'], summary: '就业需求稳定，适合有耐心、愿服务他人的同学。', cautions: '工作强度与轮班较多，需良好身心素质。' },
  { id: 'pharmacy', name: '药学', discipline: '医学', needsPhysics: true, needsSubjects: ['chemistry'], interestTags: ['medical', 'logic'], traits: { logic: 7, math: 6, creativity: 4, social: 4, writing: 5, handsOn: 7, income: 7, stability: 8, gradSchool: 7, abroad: 7, pressure: 5, publicService: 6 }, careers: ['药剂师', '医药研发', '药品注册'], summary: '医药产业链核心专业，就业面较稳。', cautions: '研发岗多要求硕士及以上学历。' },
  { id: 'tcm', name: '中医学', discipline: '医学', interestTags: ['medical', 'nature'], traits: { logic: 6, math: 4, creativity: 4, social: 7, writing: 6, handsOn: 6, income: 6, stability: 8, gradSchool: 7, abroad: 4, pressure: 6, publicService: 7 }, careers: ['中医师', '针灸推拿', '养生调理'], summary: '适合对传统文化与医学结合有兴趣的同学。', cautions: '培养周期长，执业需坚持与积累。' },
  { id: 'economics', name: '经济学', discipline: '经济学', interestTags: ['business', 'logic', 'social'], traits: { logic: 8, math: 7, creativity: 4, social: 6, writing: 6, handsOn: 2, income: 8, stability: 6, gradSchool: 8, abroad: 8, pressure: 7, publicService: 5 }, careers: ['经济分析', '咨询', '金融从业'], summary: '理论性强，适合对宏观经济、政策有兴趣的同学。', cautions: '本科需结合实习与证书，竞争较激烈。' },
  { id: 'finance', name: '金融学', discipline: '经济学', interestTags: ['business', 'logic'], traits: { logic: 7, math: 7, creativity: 4, social: 7, writing: 5, handsOn: 2, income: 9, stability: 5, gradSchool: 7, abroad: 8, pressure: 8, publicService: 3 }, careers: ['银行', '证券', '投资分析'], summary: '收入预期较高，适合抗压、对数字敏感的同学。', cautions: '行业波动大，部分岗位加班多，需关注院校与实习资源。' },
  { id: 'accounting', name: '会计学', discipline: '管理学', interestTags: ['business', 'logic'], traits: { logic: 7, math: 6, creativity: 3, social: 5, writing: 5, handsOn: 4, income: 7, stability: 8, gradSchool: 5, abroad: 6, pressure: 6, publicService: 7 }, careers: ['会计', '审计', '税务'], summary: '就业面广、需求稳定，适合细致踏实的同学。', cautions: '考证（CPA 等）对职业发展很重要。' },
  { id: 'business', name: '工商管理', discipline: '管理学', interestTags: ['business', 'social'], traits: { logic: 6, math: 5, creativity: 6, social: 8, writing: 6, handsOn: 3, income: 7, stability: 6, gradSchool: 6, abroad: 7, pressure: 6, publicService: 4 }, careers: ['管理培训生', '运营', '创业'], summary: '综合性强，适合善于沟通、有领导潜质的同学。', cautions: '本科偏泛，需通过实习和辅修建立差异化。' },
  { id: 'marketing', name: '市场营销', discipline: '管理学', interestTags: ['business', 'media', 'social'], traits: { logic: 5, math: 4, creativity: 8, social: 9, writing: 6, handsOn: 3, income: 7, stability: 5, gradSchool: 4, abroad: 6, pressure: 6, publicService: 3 }, careers: ['品牌策划', '新媒体运营', '销售管理'], summary: '适合外向、创意多、喜欢与人打交道的同学。', cautions: '业绩导向岗位压力较大，需选对行业与平台。' },
  { id: 'hr', name: '人力资源管理', discipline: '管理学', interestTags: ['social', 'business'], traits: { logic: 5, math: 3, creativity: 5, social: 9, writing: 6, handsOn: 2, income: 6, stability: 7, gradSchool: 5, abroad: 5, pressure: 5, publicService: 6 }, careers: ['HR', '招聘', '组织发展'], summary: '适合善于倾听、协调，关注人与组织关系的学生。', cautions: '大企业 HR 岗位竞争不小，实习经历很重要。' },
  { id: 'logistics', name: '物流管理', discipline: '管理学', interestTags: ['business', 'hands'], traits: { logic: 6, math: 5, creativity: 4, social: 5, writing: 4, handsOn: 6, income: 6, stability: 7, gradSchool: 3, abroad: 4, pressure: 5, publicService: 5 }, careers: ['供应链管理', '电商物流', '采购'], summary: '电商与制造业需求稳定，实操性强。', cautions: '部分岗位工作节奏快，需适应一线协调。' },
  { id: 'law', name: '法学', discipline: '法学', needsHistory: true, interestTags: ['law', 'writing', 'social'], traits: { logic: 8, math: 3, creativity: 4, social: 7, writing: 9, handsOn: 2, income: 7, stability: 7, gradSchool: 8, abroad: 6, pressure: 7, publicService: 8 }, careers: ['律师', '法务', '公务员/法官检察官'], summary: '文字与逻辑要求高，适合能严谨表达、追求公正的同学。', cautions: '法考是重要门槛，名校与读研对就业影响较大。' },
  { id: 'chinese', name: '汉语言文学', discipline: '文学', needsHistory: true, interestTags: ['writing', 'education'], traits: { logic: 5, math: 3, creativity: 8, social: 6, writing: 10, handsOn: 2, income: 5, stability: 7, gradSchool: 6, abroad: 4, pressure: 4, publicService: 8 }, careers: ['教师', '编辑', '文案策划', '公务员'], summary: '文字功底深厚，考公考编、教育方向较常见。', cautions: '对口岗位竞争大，需提前积累作品与实习。' },
  { id: 'journalism', name: '新闻学', discipline: '文学', interestTags: ['writing', 'media', 'social'], traits: { logic: 6, math: 3, creativity: 7, social: 8, writing: 9, handsOn: 4, income: 6, stability: 5, gradSchool: 5, abroad: 6, pressure: 7, publicService: 5 }, careers: ['记者', '新媒体编辑', '公关'], summary: '适合关注社会、善于表达与快速学习的同学。', cautions: '传统媒体岗位收缩，新媒体技能需自学补强。' },
  { id: 'advertising', name: '广告学', discipline: '文学', interestTags: ['design', 'media', 'writing'], traits: { logic: 5, math: 3, creativity: 9, social: 7, writing: 7, handsOn: 4, income: 7, stability: 5, gradSchool: 4, abroad: 6, pressure: 7, publicService: 3 }, careers: ['广告策划', '创意总监路径', '品牌传播'], summary: '创意与传播并重，适合脑洞大、审美在线的同学。', cautions: '行业节奏快，作品集比课本更重要。' },
  { id: 'english', name: '英语', discipline: '文学', interestTags: ['writing', 'education'], traits: { logic: 5, math: 3, creativity: 5, social: 7, writing: 8, handsOn: 2, income: 6, stability: 6, gradSchool: 6, abroad: 9, pressure: 5, publicService: 6 }, careers: ['翻译', '外贸', '教师', '外企'], summary: '语言能力强，留学与外企路径较顺畅。', cautions: '纯语言优势需叠加专业技能才更吃香。' },
  { id: 'education', name: '教育学', discipline: '教育学', interestTags: ['education', 'social'], traits: { logic: 5, math: 4, creativity: 6, social: 9, writing: 6, handsOn: 4, income: 5, stability: 8, gradSchool: 6, abroad: 5, pressure: 4, publicService: 9 }, careers: ['教师', '教育管理', '培训机构'], summary: '适合有耐心、喜欢与人成长陪伴的同学。', cautions: '教师编需考证，不同地区政策差异大。' },
  { id: 'preschool', name: '学前教育', discipline: '教育学', interestTags: ['education', 'social'], traits: { logic: 4, math: 3, creativity: 7, social: 9, writing: 5, handsOn: 6, income: 5, stability: 7, gradSchool: 4, abroad: 3, pressure: 5, publicService: 8 }, careers: ['幼儿园教师', '早教机构', '儿童发展'], summary: '喜欢孩子、有亲和力的同学较适合。', cautions: '工作需极大耐心，薪资待遇因地区而异。' },
  { id: 'visual_design', name: '视觉传达设计', discipline: '艺术学', interestTags: ['design', 'media'], traits: { logic: 4, math: 2, creativity: 10, social: 5, writing: 4, handsOn: 7, income: 6, stability: 5, gradSchool: 4, abroad: 7, pressure: 7, publicService: 3 }, careers: ['平面设计师', 'UI 设计', '品牌视觉'], summary: '审美与软件技能并重，适合热爱视觉表达的同学。', cautions: '需大量作品集，行业加班与改稿较常见。' },
  { id: 'animation', name: '动画', discipline: '艺术学', interestTags: ['design', 'media', 'tech'], traits: { logic: 5, math: 3, creativity: 10, social: 4, writing: 4, handsOn: 8, income: 6, stability: 5, gradSchool: 4, abroad: 6, pressure: 8, publicService: 2 }, careers: ['动画师', '游戏美术', '影视后期'], summary: '适合热爱动漫游戏、肯苦练技能的同学。', cautions: '工作强度大，需持续学习软件与行业趋势。' },
  { id: 'music', name: '音乐学', discipline: '艺术学', interestTags: ['media', 'education'], traits: { logic: 4, math: 2, creativity: 9, social: 6, writing: 4, handsOn: 7, income: 5, stability: 5, gradSchool: 5, abroad: 6, pressure: 6, publicService: 6 }, careers: ['音乐教师', '演奏', '文艺策划'], summary: '通常需一定艺术基础，适合真正热爱音乐的同学。', cautions: '艺考与专业训练要求高，就业面相对窄。' },
  { id: 'agronomy', name: '农学', discipline: '农学', interestTags: ['nature', 'hands'], traits: { logic: 5, math: 5, creativity: 3, social: 4, writing: 4, handsOn: 9, income: 5, stability: 7, gradSchool: 6, abroad: 5, pressure: 4, publicService: 6 }, careers: ['农业技术推广', '种业', '现代农业'], summary: '适合喜欢大自然、能接受基层实践的同学。', cautions: '部分工作较辛苦，需正确预期工作环境。' },
  { id: 'history', name: '历史学', discipline: '历史学', needsHistory: true, interestTags: ['writing', 'social'], traits: { logic: 6, math: 3, creativity: 5, social: 5, writing: 9, handsOn: 2, income: 5, stability: 7, gradSchool: 8, abroad: 5, pressure: 4, publicService: 8 }, careers: ['教师', '文博', '公务员', '研究'], summary: '阅读与写作量大，适合能静下心做学问的同学。', cautions: '本科就业面较窄，深造或考公较常见。' },
  { id: 'philosophy', name: '哲学', discipline: '哲学', needsHistory: true, interestTags: ['writing', 'social', 'logic'], traits: { logic: 8, math: 4, creativity: 6, social: 5, writing: 9, handsOn: 1, income: 5, stability: 6, gradSchool: 9, abroad: 7, pressure: 4, publicService: 6 }, careers: ['学术', '公务员', '咨询/出版'], summary: '思辨训练强，适合爱追问、能大量阅读的学生。', cautions: '非应用型学科，需尽早规划研究生或转行路径。' },
  { id: 'data_science', name: '数据科学与大数据技术', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic', 'business'], traits: { logic: 9, math: 8, creativity: 5, social: 4, writing: 4, handsOn: 5, income: 9, stability: 6, gradSchool: 7, abroad: 7, pressure: 7, publicService: 3 }, careers: ['数据工程师', '数据分析师', '算法'], summary: '数学、编程、业务理解三者兼备，热门方向。', cautions: '课程强度大，需主动做项目积累作品。' },
  { id: 'iot', name: '物联网工程', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'hands'], traits: { logic: 8, math: 7, creativity: 5, social: 4, writing: 3, handsOn: 8, income: 8, stability: 7, gradSchool: 6, abroad: 6, pressure: 6, publicService: 4 }, careers: ['嵌入式', '智能硬件', '工业互联网'], summary: '软硬件交叉，适合喜欢折腾设备与系统的同学。', cautions: '知识面宽，需找准细分方向深耕。' },
  { id: 'ecommerce', name: '电子商务', discipline: '管理学', interestTags: ['business', 'tech', 'media'], traits: { logic: 6, math: 5, creativity: 7, social: 7, writing: 5, handsOn: 4, income: 7, stability: 5, gradSchool: 3, abroad: 5, pressure: 6, publicService: 3 }, careers: ['电商运营', '直播电商', '跨境电商'], summary: '商业与互联网结合，适合反应快、敢尝试的同学。', cautions: '行业变化快，实践经验比课本更重要。' },
  { id: 'public_admin', name: '公共事业管理', discipline: '管理学', interestTags: ['social', 'law'], traits: { logic: 6, math: 3, creativity: 4, social: 8, writing: 7, handsOn: 3, income: 5, stability: 9, gradSchool: 6, abroad: 4, pressure: 4, publicService: 10 }, careers: ['公务员', '事业单位', '社会组织'], summary: '偏公共管理，适合追求稳定、愿服务公众的同学。', cautions: '考公竞争大，需提前了解岗位与专业限制。' },
  { id: 'international_trade', name: '国际经济与贸易', discipline: '经济学', interestTags: ['business', 'writing'], traits: { logic: 6, math: 5, creativity: 4, social: 7, writing: 6, handsOn: 2, income: 7, stability: 6, gradSchool: 5, abroad: 8, pressure: 6, publicService: 4 }, careers: ['外贸业务', '跨境运营', '国际物流'], summary: '英语与商务兼备，适合外向、愿接触国际业务的同学。', cautions: '受宏观经济与汇率影响，需关注行业周期。' },
  { id: 'sports', name: '体育教育', discipline: '教育学', interestTags: ['hands', 'education'], traits: { logic: 4, math: 3, creativity: 5, social: 8, writing: 4, handsOn: 9, income: 5, stability: 7, gradSchool: 4, abroad: 4, pressure: 5, publicService: 8 }, careers: ['体育教师', '教练', '体能训练'], summary: '适合身体素质好、热爱运动与教学的同学。', cautions: '部分方向需专项技能，就业地域性较强。' },
  { id: 'food_science', name: '食品科学与工程', discipline: '工学', needsPhysics: true, needsSubjects: ['chemistry', 'biology'], interestTags: ['hands', 'nature', 'medical'], traits: { logic: 6, math: 5, creativity: 4, social: 4, writing: 4, handsOn: 8, income: 6, stability: 8, gradSchool: 5, abroad: 5, pressure: 4, publicService: 6 }, careers: ['食品研发', '质检', '营养配餐'], summary: '与生活贴近，就业稳定，实验与法规并重。', cautions: '研发岗学历要求渐高，工厂质检需耐得住重复。' },
  { id: 'urban_planning', name: '城乡规划', discipline: '工学', interestTags: ['design', 'nature', 'social'], traits: { logic: 6, math: 6, creativity: 8, social: 6, writing: 6, handsOn: 5, income: 7, stability: 7, gradSchool: 6, abroad: 6, pressure: 6, publicService: 7 }, careers: ['城市规划师', '土地管理', '设计院'], summary: '设计与社会科学交叉，适合关心城市发展的同学。', cautions: '注册规划师等执业资格需长期积累。' },
  { id: 'materials', name: '材料科学与工程', discipline: '工学', needsPhysics: true, needsSubjects: ['chemistry'], interestTags: ['logic', 'hands', 'tech'], traits: { logic: 7, math: 7, creativity: 5, social: 3, writing: 4, handsOn: 8, income: 7, stability: 8, gradSchool: 8, abroad: 7, pressure: 5, publicService: 5 }, careers: ['新材料研发', '半导体材料', '新能源'], summary: '制造业与高科技的上游，深造后更有优势。', cautions: '本科多进工厂或研发助理，读研比例较高。' },
  { id: 'electrical', name: '电气工程及其自动化', discipline: '工学', needsPhysics: true, interestTags: ['tech', 'logic', 'hands'], traits: { logic: 8, math: 8, creativity: 4, social: 4, writing: 3, handsOn: 7, income: 8, stability: 8, gradSchool: 6, abroad: 5, pressure: 6, publicService: 7 }, careers: ['电力系统', '电气设计', '新能源'], summary: '电网、制造业需求稳，适合数理基础好的同学。', cautions: '部分岗位需现场调试，注意方向选择。' },
  { id: 'safety', name: '安全工程', discipline: '工学', needsPhysics: true, interestTags: ['logic', 'social'], traits: { logic: 7, math: 6, creativity: 3, social: 5, writing: 5, handsOn: 6, income: 6, stability: 9, gradSchool: 4, abroad: 4, pressure: 4, publicService: 8 }, careers: ['安全生产管理', '环评安全', '央企 EHS'], summary: '合规需求稳定，适合细致、责任心强的同学。', cautions: '部分岗位需进工厂现场，工作环境需了解。' },
  { id: 'tourism', name: '旅游管理', discipline: '管理学', interestTags: ['social', 'media', 'business'], traits: { logic: 4, math: 3, creativity: 7, social: 9, writing: 5, handsOn: 4, income: 5, stability: 5, gradSchool: 3, abroad: 6, pressure: 5, publicService: 5 }, careers: ['旅游策划', '酒店管理', '文旅运营'], summary: '适合外向、喜欢体验与分享的同学。', cautions: '行业受季节与政策影响，需灵活就业心态。' },
  { id: 'social_work', name: '社会工作', discipline: '法学', interestTags: ['social', 'education'], traits: { logic: 5, math: 3, creativity: 5, social: 10, writing: 6, handsOn: 5, income: 5, stability: 7, gradSchool: 6, abroad: 5, pressure: 5, publicService: 9 }, careers: ['社工', '公益组织', '社区服务'], summary: '助人导向强，适合同理心高、愿做基层服务的同学。', cautions: '薪资普遍不高，需真正认同职业价值。' },
  { id: 'geography', name: '地理科学', discipline: '理学', interestTags: ['nature', 'logic'], traits: { logic: 6, math: 6, creativity: 5, social: 4, writing: 5, handsOn: 6, income: 6, stability: 7, gradSchool: 7, abroad: 6, pressure: 4, publicService: 7 }, careers: ['地理教师', '遥感 GIS', '自然资源'], summary: '与自然、GIS 技术结合，适合喜欢地图与环境的同学。', cautions: 'GIS 方向需补编程，教师方向需考证。' },
  { id: 'politics', name: '思想政治教育', discipline: '法学', needsHistory: true, interestTags: ['education', 'social', 'writing'], traits: { logic: 6, math: 3, creativity: 4, social: 8, writing: 8, handsOn: 2, income: 5, stability: 9, gradSchool: 5, abroad: 3, pressure: 4, publicService: 10 }, careers: ['思政教师', '党务', '公务员'], summary: '体制内导向明显，适合愿走教师或公职路径的同学。', cautions: '就业地域与编制政策关联紧密，提前调研目标省份。' },
  { id: 'informatics', name: '信息管理与信息系统', discipline: '管理学', interestTags: ['tech', 'business'], traits: { logic: 7, math: 6, creativity: 5, social: 6, writing: 5, handsOn: 4, income: 7, stability: 7, gradSchool: 5, abroad: 5, pressure: 5, publicService: 6 }, careers: ['信息系统实施', 'ERP', '数据管理'], summary: '管理与 IT 交叉，适合不善纯码但懂业务的同學。', cautions: '需主动学数据库与产品知识，避免学成「四不像」。' },
  { id: 'bio_medical', name: '生物医学工程', discipline: '工学', needsPhysics: true, needsSubjects: ['biology'], interestTags: ['medical', 'tech', 'hands'], traits: { logic: 8, math: 7, creativity: 5, social: 4, writing: 4, handsOn: 7, income: 7, stability: 7, gradSchool: 8, abroad: 8, pressure: 6, publicService: 5 }, careers: ['医疗器械', '医学影像', '生物材料'], summary: '医工交叉，适合对医疗科技有兴趣的理科生。', cautions: '涉及电子与生物，课程跨度大，需找准细分。' },
  { id: 'energy', name: '新能源科学与工程', discipline: '工学', needsPhysics: true, needsSubjects: ['chemistry'], interestTags: ['tech', 'nature', 'hands'], traits: { logic: 7, math: 7, creativity: 5, social: 4, writing: 4, handsOn: 7, income: 7, stability: 8, gradSchool: 7, abroad: 7, pressure: 5, publicService: 6 }, careers: ['光伏/储能', '新能源汽车', '电力'], summary: '政策扶持方向，适合关注碳中和与能源转型的同学。', cautions: '产业周期波动，选校需看校企资源。' },
];

export const SUBJECTS = [
  { id: 'physics', label: '物理' },
  { id: 'chemistry', label: '化学' },
  { id: 'biology', label: '生物' },
  { id: 'history', label: '历史' },
  { id: 'politics', label: '政治' },
  { id: 'geography', label: '地理' },
  { id: 'technology', label: '技术' },
];

export function getMajorById(id) {
  return MAJORS.find(m => m.id === id) || null;
}

export function majorReferenceLinks(major) {
  const q = encodeURIComponent(major.name);
  const custom = major.links || [];
  const defaults = [
    { label: '阳光高考', url: 'https://gaokao.chsi.com.cn/', desc: '教育部阳光高考信息平台' },
    { label: `${major.name} · 学什么`, url: `https://www.baidu.com/s?wd=${q}%20专业%20学什么%20就业`, desc: '搜索专业介绍与就业方向' },
    { label: `${major.name} · 知乎讨论`, url: `https://www.zhihu.com/search?type=content&q=${q}%E4%B8%93%E4%B8%9A`, desc: '看看学长学姐的经验分享' },
  ];
  return custom.length ? [...custom, ...defaults] : defaults;
}

export function describeMajorTraits(major) {
  const t = major.traits || {};
  const lines = [];
  if (t.logic >= 8 || t.math >= 8) lines.push('数理与逻辑思维要求较高，理科基础扎实更有优势。');
  if (t.creativity >= 8) lines.push('需要较强的创意与审美能力，适合乐于表达和试错的同学。');
  if (t.social >= 8) lines.push('人际沟通是重要能力，适合善于协作、乐于与人打交道。');
  if (t.handsOn >= 8) lines.push('实验与动手实践较多，适合喜欢动手验证想法的同学。');
  if (t.gradSchool >= 8) lines.push('深造比例较高，读研或考证可能是常见发展路径。');
  if (t.income >= 8) lines.push('市场化岗位薪资弹性较大，能力与行业选择影响明显。');
  if (t.publicService >= 8) lines.push('公共服务、体制内相关岗位占比较高。');
  if (t.pressure >= 8) lines.push('部分方向工作节奏快、压力较大，需提前做好心理准备。');
  if (t.abroad >= 8) lines.push('出国深造或外企就业的机会相对更多。');
  return lines.slice(0, 4);
}
