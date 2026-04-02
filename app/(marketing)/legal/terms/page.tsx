export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-10 py-16 max-w-3xl mx-auto">
      <h1 className="text-4xl font-display font-extrabold mb-8">服务条款</h1>
      <div className="space-y-6 text-base text-muted-foreground leading-relaxed">
        <p>最后更新：2026 年 4 月</p>
        <h2 className="text-xl font-display font-bold text-foreground">1. 服务描述</h2>
        <p>海投 OS 是一个 AI 驱动的求职运营平台。7 位 AI 专员代表你在各招聘平台上搜索、筛选、投递和跟进机会。</p>
        <h2 className="text-xl font-display font-bold text-foreground">2. 用户责任</h2>
        <p>你授权系统使用你提供的会话凭证在招聘平台上执行操作。你对提供的简历内容的真实性负责。</p>
        <h2 className="text-xl font-display font-bold text-foreground">3. 自动化边界</h2>
        <p>系统在遇到薪资谈判、面试安排、私人联系方式等敏感话题时会自动暂停，交由你亲自处理。</p>
        <h2 className="text-xl font-display font-bold text-foreground">4. 平台风险</h2>
        <p>自动化操作可能违反某些平台的服务条款。系统以保守的速率运行以降低风险，但不能完全消除账号限制的可能性。</p>
        <h2 className="text-xl font-display font-bold text-foreground">5. 退款政策</h2>
        <p>付费套餐支持 7 天内无条件退款。运行时间不可退还。</p>
      </div>
    </div>
  );
}
