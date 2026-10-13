从零理解 EasyTier：本机网页实验

完整图文说明：https://easytier.icebreaker.top/basics

1. 解压后进入 network-basics-demo 专用目录，确认只有 index.html、message.txt、README.txt。
2. 打开终端并进入此目录。macOS/Linux 用 python3 --version 检查；Windows 用 py -3 --version。
3. macOS/Linux：python3 -m http.server 8877 --bind 127.0.0.1
   Windows：py -3 -m http.server 8877 --bind 127.0.0.1
   若实际 Python 入口不同，仅替换命令开头。若端口占用，改用8878，浏览器地址同步更改，不结束未知程序。
4. Chrome 地址栏打开 http://127.0.0.1:8877/，应看到“这是我电脑上的网页”。
5. 网络面板录制并停用缓存，清空列表，分别访问 /message.txt 和 /not-here.txt，观察200和404。
6. 在专门运行服务的终端按 Control+C，然后请求 http://127.0.0.1:8877/message.txt?after-stop=1，应连接失败。
7. 可再次启动确认恢复，再按 Control+C停止。已有EasyTier GUI与网络保持运行。

服务只监听当前电脑的回环地址，不供其他电脑访问。不要在个人文件目录运行，不扩大监听到0.0.0.0，不扫描端口。此实验不用第三方依赖，不自动安装程序，不发送遥测。本服务仅用于短时学习，不作为生产网页服务。
