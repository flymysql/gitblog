# 高考录取参考数据

## 文件说明

| 文件 | 说明 |
|------|------|
| `school-lines.csv` | 由 `npm run admission:import` 从开源库生成的**院校投档线**（2020 年本科批） |
| `major-lines.csv` | **专业投档线**补充表，可手工维护或放入 `sources/*.csv` |
| `provinces/*.json` | 按省+科类切分的运行时索引（985/211/双一流院校） |
| `meta.json` | 导入元数据 |
| `admissions.json.gz` | 原始开源数据包（首次导入自动下载，约 5MB） |

## 数据来源

- 院校线：[labolado/gaokao_2016-2020](https://github.com/labolado/gaokao_2016-2020)（2016–2020，不含浙江、上海）
- 清洗打包：[wei011/gaokao-zhiyuan-simulator](https://github.com/wei011/gaokao-zhiyuan-simulator)

## 更新数据

```bash
npm run admission:import
```

添加专业线：编辑 `major-lines.csv` 或 `sources/某省-2024-专业线.csv`，列名需与模板一致，然后重新导入。

## 免责声明

数据来自第三方开源整理，未经官方校验，仅供志愿参考，请以省考试院与高校招生章程为准。
