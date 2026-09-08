# 每日签到 UI 复刻

React + TypeScript + Vite 实现的移动端签到页，以 `390 × 844` 为主要视觉基准，并兼容 `320 / 375 / 390 / 430px` 宽度。

## 运行

```bash
npm install
npm run dev
```

本地预览：<http://localhost:4173/>

签到请求默认模拟成功。可通过查询参数切换三种结果：

- `?mock=success`：约 760ms 后成功
- `?mock=error`：约 760ms 后失败，可重试
- `?mock=timeout`：先进入“正在确认…”，确认失败后再开放重试

签到状态只保存在页面内存中，刷新后恢复“余额 434、连续 6 天、第 7 天领取 +7”的演示状态。第 7 天领取后当天保持完成态；带上 `prototypeControls=1` 可在完成后通过页面按钮模拟进入下一自然日，并从第 1 天开始下一轮。`scenario` 只用于隔离通知设置的本地记录。

通知原型可通过查询参数切换测试场景：

- `notificationSeed=default|granted|granted-off|denied`
- `permissionResult=granted|denied`
- `systemPermission=denied`：模拟页面重新获得焦点时权限已被系统撤销
- `prototypeControls=1`：显示“模拟进入下一自然日”测试入口，不通过刷新冒充日期推进

通知权限、提醒开关、提醒时间和通知任务奖励记录会写入当前 `scenario` 对应的 localStorage；未调用真实 iOS 通知接口。

邀请规则文案按每位有效新用户奖励 2 布拉币、不限次数展示，但真实邀请流程尚未接入。布拉币余额入口已保留，详情页未实现时返回临时提示。

## 构建

```bash
npm run build
```

复杂插画与硬币资源位于 `public/assets/`；页面文字、状态栏、导航、按钮、开关、进度与弹层均由代码渲染。
