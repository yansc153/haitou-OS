export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-10 py-16 max-w-3xl mx-auto">
      <h1 className="text-4xl font-display font-extrabold mb-8">隐私政策</h1>
      <div className="space-y-6 text-base text-muted-foreground leading-relaxed">
        <p>最后更新：2026 年 4 月</p>
        <h2 className="text-xl font-display font-bold text-foreground">1. 数据收集</h2>
        <p>海投 OS 收集你主动提供的信息（简历、求职偏好、联系方式）以及平台连接所需的会话凭证（Cookie）。我们不收集密码。</p>
        <h2 className="text-xl font-display font-bold text-foreground">2. 数据存储</h2>
        <p>所有简历和平台凭证均通过 AES-256 加密存储于 Supabase Vault。对话数据加密存储，绝不对外共享。</p>
        <h2 className="text-xl font-display font-bold text-foreground">3. 数据使用</h2>
        <p>你的数据仅用于自动化求职操作（搜索、匹配、投递、跟进）。我们不会将数据出售给第三方。</p>
        <h2 className="text-xl font-display font-bold text-foreground">4. 用户权利</h2>
        <p>你可以随时删除账号和所有关联数据。平台连接可随时撤销。</p>
        <h2 className="text-xl font-display font-bold text-foreground">5. 联系方式</h2>
        <p>如有隐私相关问题，请联系 privacy@haitou.os</p>
      </div>
    </div>
  );
}
