import os
from dotenv import load_dotenv
from langgraph.prebuilt import create_react_agent
from langchain_community.tools.file_management import (
    ReadFileTool,
    ListDirectoryTool,
    FileSearchTool,
)
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from .tools import forensic_tree_view, forensic_grep
from .memory import get_session_history

load_dotenv()

# Define the sandbox path - using the reports directory
SANDBOX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports"))

# Ensure sandbox directory exists
os.makedirs(SANDBOX_PATH, exist_ok=True)

# Set up tools individually for strict read-only access
file_tools = [
    ReadFileTool(root_dir=SANDBOX_PATH),
    ListDirectoryTool(root_dir=SANDBOX_PATH),
    FileSearchTool(root_dir=SANDBOX_PATH),
    forensic_tree_view,
    forensic_grep,
]

# Configure LLM with OpenRouter
llm = ChatOpenAI(
    model="z-ai/glm-4.6",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    streaming=True,
)

AGENT_SYSTEM_PROMPT = """You are a highly skilled Forensic Analyst. Your task is to analyze iLEAPP and aLEAPP reports to answer user questions with precision.

You operate in a strictly READ-ONLY environment. You cannot create, modify, or delete any files.

Available Tools:
1. `list_directory`: Lists files in a specific folder.
2. `file_search`: Searches for files matching a glob pattern (e.g., `**/*.html`). Use this to find specific artifact files.
3. `read_file`: Reads the full content of a file. Use for smaller JSON or text files.
4. `forensic_tree_view`: Shows the entire directory hierarchy. Start here if you are lost.
5. `forensic_grep`: Searches for specific text/patterns within a file. BEST for large HTML reports.

Workflow:
- Start by exploring the directory structure with `forensic_tree_view`.
- Use `file_search` or `list_directory` to find relevant reports.
- Use `forensic_grep` to find specific keywords (e.g., "WhatsApp", "Messages", "Accounts") in large reports.
- Provide detailed, evidence-based answers.
"""

# Create the LangGraph ReAct agent
agent = create_react_agent(
    model=llm,
    tools=file_tools,
    prompt=AGENT_SYSTEM_PROMPT
)


def get_agent_executor():
    """
    Returns the configured DeepAgent executor.
    """
    return agent


def invoke_agent_with_history(message: str, session_id: str) -> str:
    """
    Invoke the agent with conversation history from the session.
    """
    history = get_session_history(session_id)
    
    # LangGraph ReAct agent expects a list of messages in the 'messages' key
    input_state = {"messages": history.messages + [HumanMessage(content=message)]}
    
    result = agent.invoke(input_state)
    
    # The result is the final state, where result["messages"] contains the conversation
    final_response = result["messages"][-1].content
    
    # Save to history
    history.add_user_message(message)
    history.add_ai_message(final_response)
    
    return final_response


async def stream_agent_with_history(message: str, session_id: str):
    """
    Stream agent response with conversation history.
    """
    history = get_session_history(session_id)
    
    # Build input state
    input_state = {"messages": history.messages + [HumanMessage(content=message)]}
    
    # Save user message immediately
    history.add_user_message(message)
    
    full_response = ""
    
    # Use astream_events with version v2
    async for event in agent.astream_events(input_state, version="v2"):
        # We want to yield tokens from the 'agent' node's model stream
        if event["event"] == "on_chat_model_stream":
            # Ensure we are catching the model stream, not something else
            chunk = event["data"]["chunk"]
            if hasattr(chunk, 'content') and chunk.content:
                content = chunk.content
                full_response += content
                yield content
    
    # Save complete response to history
    if full_response:
        history.add_ai_message(full_response)


# Initialize naming LLM
try:
    naming_llm = ChatOpenAI(
        model="z-ai/glm-4.6",
        openai_api_key=os.getenv("OPENROUTER_API_KEY"),
        openai_api_base="https://openrouter.ai/api/v1",
        streaming=False,
    )
except Exception:
    # Fallback to main LLM if specific model fails init
    naming_llm = llm

async def generate_chat_title(first_user_message: str) -> str:
    """
    Generate a concise title for the chat based on the first user message.
    """
    try:
        messages = [
            HumanMessage(content=f"Generate a short, concise title (max 5 words) for a chat that starts with this message: '{first_user_message}'. Return ONLY the title text, no quotes, no prefixes.")
        ]
        # Use simple invoke for non-streaming response
        response = await naming_llm.ainvoke(messages)
        title = response.content.strip().replace('"', '').replace("'", "")
        
        # Log the generated title for debugging
        print(f"Generated title for message '{first_user_message[:20]}...': {title}")
        
        return title if title else "New Chat"
    except Exception as e:
        print(f"Error generating chat title: {e}")
        return "New Chat"
