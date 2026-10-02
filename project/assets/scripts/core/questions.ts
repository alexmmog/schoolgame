export interface Choice { readonly id: string; readonly text: string }
export interface Question {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly Choice[];
  readonly correctChoice: string;
  readonly explanation: string;
}

export const BANK_REVISION = 'original-demo-2026-10-01-v1';
// Original wording and fictional situations; no external question bank.
export const QUESTIONS: readonly Question[] = [
  {
    id: 'minutes', text: '小林给自己设了 1 小时的休息时间。\n1 小时等于多少分钟？',
    choices: [{ id: '60', text: '60 分钟' }, { id: '100', text: '100 分钟' }],
    correctChoice: '60', explanation: '一小时等于 60 分钟。',
  },
  {
    id: 'group', text: '原创群聊情境：公告要求\n“报名时发送：口令花园 + 昵称”。\n下面哪条消息符合这份公告？',
    choices: [
      { id: 'a', text: '收到' }, { id: 'b', text: '花园 + 小满' },
      { id: 'c', text: '小满' }, { id: 'd', text: '我来啦' },
    ], correctChoice: 'b', explanation: '“花园 + 小满”同时包含指定口令和昵称。',
  },
  {
    id: 'joke', text: '原创对话：阿晴周末 11 点才起床，\n笑着说：“我这个早八勇士迟到了。”\n她还补了一句：“开玩笑的啦。”\n这句话在这段对话里是什么语气？',
    choices: [
      { id: 'a', text: '正式通知' }, { id: 'b', text: '天气预报' },
      { id: 'c', text: '自嘲玩笑' }, { id: 'd', text: '活动报名' },
    ], correctChoice: 'c', explanation: '上下文直接说明这是阿晴的自嘲玩笑。',
  },
];
