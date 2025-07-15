import streamlit as st
import requests
import json
from datetime import datetime
import base64

st.set_page_config(page_title="🎓 教育智能体", layout="centered")

# 顶部作者信息显示
st.markdown("""
<div style="text-align:center; font-size:16px; color:gray; margin-bottom:10px;">
    作者：谯舒元、李秋月&nbsp;&nbsp;|&nbsp;&nbsp;单位：南充电影工业职业学院
</div>
""", unsafe_allow_html=True)

# --------- 初始化 session_state ---------
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []

if "system_prompt" not in st.session_state:
    st.session_state.system_prompt = "你是一个热心、专业、善于解答学生问题的教育智能体。"

if "input_question" not in st.session_state:
    st.session_state.input_question = ""

# --------- AI 请求函数 ---------
def teacher_bot(messages):
    url = "https://api.just2chat.cn/v1/chat/completions"
    headers = {
        "Authorization": "sk-JrpAHgYs3V2oi4hUp30GwJeaOTJqpiuBKc0sLs9zWzNs273C",  # 替换自己的真实 Key
        "Content-Type": "application/json"
    }
    payload = {
        "model": "deepseek-v3",
        "messages": messages
    }
    try:
        response = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except requests.exceptions.Timeout:
        return "请求超时啦，服务器可能繁忙，请稍后再试～"
    except requests.exceptions.RequestException as e:
        return f"请求出错，请稍后重试。\n错误详情：{str(e)}"

# --------- 标题 ---------
st.title("🎓 AI 教育智能体")
st.markdown("""
欢迎使用教育智能体，输入你的问题，AI 将为你解答。  
支持多轮对话，可点击「清空聊天记录」或「导出聊天」保存内容。
""")

# --------- 系统身份设置 ---------
with st.expander("⚙️ 高级设置"):
    custom_system = st.text_area("系统身份描述（可选，个性化 AI 回答）", value=st.session_state.system_prompt)
    if st.button("更新系统身份"):
        st.session_state.system_prompt = custom_system
        st.success("系统身份已更新，下次提问生效！")

# --------- 展示聊天记录（气泡美化） ---------
for chat in st.session_state.chat_history:
    role = "你" if chat["role"] == "user" else "智能体"
    bg_color = "#DCF8C6" if role == "你" else "#F1F0F0"            # 用户消息绿色，智能体灰色
    border = "solid #34B7F1" if role == "你" else "solid #E5E5EA"       # 边框颜色区分
    timestamp = chat["time"].strftime("%Y-%m-%d %H:%M:%S")              # 格式化时间戳

# ---------用HTML和CSS样式渲染对话气泡 ---------
    st.markdown(
        f"""
        <div style="
            background-color: {bg_color};
            border: {border};
            padding: 10px 15px;
            border-radius: 10px;
            margin-bottom: 5px;
            max-width: 80%;
            word-wrap: break-word;">
            <strong>{role} [{timestamp}]：</strong><br>{chat["content"]}
        </div>
        """,
        unsafe_allow_html=True
    )

# --------- 聊天导出 ---------
if st.session_state.chat_history:                   # 如果有聊天记录，提供导出聊天记录为Markdown文件的功能
    export_text = ""
    for chat in st.session_state.chat_history:
        role = "你" if chat["role"] == "user" else "智能体"
        timestamp = chat["time"].strftime("%Y-%m-%d %H:%M:%S")
        export_text += f"## {role} [{timestamp}]\n{chat['content']}\n\n"
    b64 = base64.b64encode(export_text.encode()).decode()
    href = f'<a href="data:file/text;base64,{b64}" download="chat_history.md">📄 下载聊天记录</a>'
    st.markdown(href, unsafe_allow_html=True)

# --------- 回调函数（提交后清空输入框） ---------
def on_submit():
    question = st.session_state.input_question.strip()
    if not question:
        st.warning("请输入一个问题后再提交！")
        return

    now = datetime.now()

    # 添加系统提示（只添加一次）
    if not any(msg["role"] == "system" for msg in st.session_state.chat_history):
        st.session_state.chat_history.insert(0, {
            "role": "system",
            "content": st.session_state.system_prompt,
            "time": now
        })

    # 用户消息
    st.session_state.chat_history.append({
        "role": "user",
        "content": question,
        "time": now
    })

    # 构造对话消息
    messages = [{"role": chat["role"], "content": chat["content"]} for chat in st.session_state.chat_history]

    with st.spinner("智能体正在思考..."):
        answer = teacher_bot(messages)

    # AI 回复
    st.session_state.chat_history.append({
        "role": "assistant",
        "content": answer,
        "time": datetime.now()
    })

    # 清空输入
    st.session_state.input_question = ""

# --------- 输入框（带 on_change） ---------
st.text_input("请输入你的问题：", key="input_question", on_change=on_submit)

# --------- 按钮区域 ---------
col1, col2 = st.columns([1, 1])

with col1:
    if st.button("🧹 清空聊天记录"):
        st.session_state.chat_history = []
        st.success("已清空聊天记录！")

with col2:
    if st.button("🔄 重新加载"):
        st.rerun()
