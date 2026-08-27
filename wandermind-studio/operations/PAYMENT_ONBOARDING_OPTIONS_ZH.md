# WanderMind 银行卡收款接入说明（中文）

更新时间：2026-08-27

## 当前已确认的试点条件

- 收款主体国家/地区：中国大陆；
- 账户路线：PayPal Business 的个人卖家；
- 结算银行账户国家：中国大陆；
- 首个沙盒商品：`专业路线解锁`，网站产品展示价保持 `¥9.9`；PayPal 沙盒订单先使用后台明确支持的跨境币种，默认测试值为 `USD 1.39`；
- 当前阶段：用户于 2026-08-27 报告 PayPal 中国账户已通过审核、可以跨境收付款，且中国大陆银行卡已绑定；跨境人民币结算产品是否完成单独审核仍以 PayPal 后台为准。下一步只建立 Sandbox，不进行真实扣款。

## 先说结论

拥有一张 Mastercard 只能说明你能用这张卡付款，不能让网站自动向游客的 Visa/Mastercard 收款。网站收卡需要：

1. 可被支付平台审核的商户主体或个体经营者身份；
2. 与该主体匹配的结算银行账户；
3. 支付平台完成 KYC/KYB 审核；
4. 先使用托管 Payment Link / Checkout，再由 webhook 解锁网站权益；
5. 退款、争议、隐私和账务流程。

WanderMind 目前不应自己保存卡号，也不应在主体和结算国家未确定前接入生产支付。

## 三条现实路径

### A. 中国大陆主体：优先试 PayPal 商家账户

- 用真实个人卖家或企业资料注册/升级 PayPal 商家账户。
- 绑定与主体一致的结算账户并完成审核。
- 先在 Sandbox 创建一个 `USD 1.39` 的专业路线测试订单，不使用真实银行卡扣款。`USD 1.39` 只用于打通流程，不代表已经确定生产汇率或最终实收币种。
- 只有实际到账、退款、争议和 webhook 都验证后，才接入自动解锁。

PayPal 中国的账户选择页把 Business Account 分为“个人卖家”和“企业”。个人卖家仍需要填写真实的个体经营者信息与身份证件；如果注册页面要求某项经营登记资料而你无法如实提供，应停止该步骤，不要编造资料或误选企业账户。

## PayPal 注册与 Sandbox 步骤

### 阶段 1：创建并验证收款账户

1. 打开 PayPal 中国官方账户选择页，选择 `Business Account`，再选择 `Individual Seller / 个人卖家`。
2. 使用长期可访问的邮箱注册；账户姓名必须与身份证件一致。
3. 如实填写个人卖家/个体经营者信息。`trade name` 可以填写面向游客展示的名称，但法律姓名和经营信息不能虚构。
4. 只在 PayPal 官方页面上传身份证件，并完成邮箱、手机和身份验证；不要把证件发给 Codex。
5. 绑定中国大陆结算银行账户，账户持有人应与 PayPal 审核主体一致。
6. 等待账户显示可以接收付款；如果页面出现补充材料、限制或人工审核，先完成审核，不进入网站集成。

### 阶段 2：创建开发者 Sandbox

1. 登录 PayPal Developer Dashboard，进入 `Apps & Credentials`。
2. 切换到 `Sandbox`，确认存在 Sandbox Business 收款账户；没有时先创建一个。
3. 创建应用，建议名称：`WanderMind Route Unlock Sandbox`。
4. 保存 Sandbox Client ID；Client Secret 只放入 Render 的秘密环境变量，不发送到聊天、不提交 Git。
5. 后续由网站后端创建订单和捕获付款；浏览器不能保存 Client Secret，也不能自行决定订单金额。

当前不要在 `paypal.com/buttons` 创建生产付款链接或按钮。无代码按钮适合人工核对的早期试卖，但不能可靠地把付款绑定到 WanderMind 的 `trip_id`，也不能单独证明 webhook、重复通知、退款和权益回收已经安全。自动解锁采用 PayPal Orders API：后端创建订单，后端捕获付款，并以已验证且幂等的 webhook 更新路线权益。

计划使用的环境变量名称：

```text
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=<Sandbox Client ID>
PAYPAL_CLIENT_SECRET=<Sandbox Client Secret>
PAYPAL_WEBHOOK_ID=<创建 webhook 后得到>
PAYPAL_CURRENCY=USD
PAYPAL_ROUTE_PRICE=1.39
```

PayPal 官方币种表把 CNY 限定为境内 PayPal 账户的付款或持有币种；中国大陆商家的公开跨境收款固定费用表也没有列出 CNY。因此本阶段不能把 `PAYPAL_CURRENCY=CNY` 当作已验证生产配置。网站仍可展示人民币首发价，但结账页必须在付款前明确显示实际扣款币种和金额。账户审核完成后，再以 PayPal 后台实际开放的币种为准决定生产配置。

### 阶段 3：上线前测试门禁

必须依次验证：成功付款、用户取消、支付工具被拒、重复 webhook、不重复解锁、退款后状态、管理员查询。收到 PayPal 已验证的 webhook 后才允许解锁专业路线，不能仅凭浏览器跳转到“成功页”解锁。

## ¥9.9 的商业风险

PayPal 中国公开费率显示，国际商业收款通常包含百分比费率和固定费用；低价商品的固定费用占比会很高。低于 5 美元的 Micropayments 费率需要另行申请和 PayPal 预批准，中国大陆银行提现还可能产生单次费用。因此：

- `USD 1.39` 仅适合作为 Sandbox 流程测试值；网站的 `¥9.9` 是产品首发价，不等于 PayPal 已确认可直接用 CNY 跨境结算；
- 在真实上线前必须先看账户后台给出的实际费率和提现方式；
- 若手续费占比过高，应把 PayPal 商品改为更高价值的专业路线套餐，或把多个路线权益合并结算，而不是悄悄加价。

### B. 印尼注册商户：评估 Xendit

- 需要 PT、CV、PMA 或符合 Xendit 规则的当地经营主体及银行账户。
- 申请卡支付并等待平台审核；不能因为自己有 Mastercard 就跳过商户审核。
- 适合未来由印尼实体承接本地 Visa/Mastercard 与当地支付方式。

### C. Stripe Indonesia：暂不作为默认首选

- 官方资料显示印度尼西亚账户仍有 invite-only / preview 边界。
- 在拿到明确邀请、主体审核和跨境收款能力前，不应在网站承诺 Stripe 卡支付可用。

## 微信与支付宝二维码

已有二维码可以继续作为人工确认后的补充收款方式，但不要直接放在公开页面让任何人无上下文扫码。更稳妥的流程是：

1. 用户选择专业路线；
2. 网站显示订单摘要和应付金额；
3. 用户确认后进入受控付款说明；
4. 人工核对到账，再解锁专业路线；
5. 记录订单号、金额、币种、到账时间和退款状态，不记录无关个人信息。

## 下一次协作检查点

用户已报告阶段 1 完成。现在进入阶段 2，只需完成以下无真实扣款步骤：

1. 打开 PayPal Developer Dashboard 的 `Apps & Credentials`；
2. 切换到 `Sandbox`；
3. 确认能看到一个 Sandbox Business 账户和一个 Sandbox Personal 账户；
4. 创建 Merchant 类型应用，名称 `WanderMind Route Unlock Sandbox`；
5. 只告诉 Codex“应用已创建、两个测试账户可见、可查看 Client ID/Secret”这三项状态。不要发送 Client Secret、身份证件、银行卡信息或账户链接。

完成后再由 Codex 开发 Sandbox 创建订单、捕获、webhook 与退款门禁，并指导将秘密值仅写入 Render 环境变量。在 Sandbox E2E 通过之前不创建生产按钮、不进行真实付款。

## 本轮官方核对入口

- PayPal 中国账户选择页：https://www.paypal.com/c2/webapps/mpp/account-selection?locale.x=zh_c2
- PayPal Developer 币种表：https://developer.paypal.com/reference/currency-codes/
- PayPal 中国大陆商家费率：https://www.paypal.com/c2/business/paypal-business-fees?locale.x=zh_C2
