import os
from dotenv import load_dotenv
from deepagents import create_deep_agent
from langchain_community.agent_toolkits import FileManagementToolkit
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from .memory import get_session_history

load_dotenv()

# Define the sandbox path - using the reports directory
SANDBOX_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "reports"))

# Ensure sandbox directory exists
os.makedirs(SANDBOX_PATH, exist_ok=True)

# Set up file management toolkit
file_toolkit = FileManagementToolkit(
    root_dir=SANDBOX_PATH,
    selected_tools=["read_file", "list_directory", "file_search"]
)
file_tools = file_toolkit.get_tools()

# Configure LLM with OpenRouter
llm = ChatOpenAI(
    model="z-ai/glm-4.6",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    openai_api_base="https://openrouter.ai/api/v1",
    streaming=True,
)

AGENT_SYSTEM_PROMPT = """You are a helpful forensic agent. Specifically your job is to analyze iLEAPP and aLEAPP reports to best answer user questions. There are two sub directories in your directory 1. aleapp-reports 2. ileapp-reports
"""

# Create agent with file tools and custom model
agent = create_deep_agent(
    model=llm,
    tools=file_tools,
    system_prompt=AGENT_SYSTEM_PROMPT
)


def get_agent_executor():
    """
    Returns the configured DeepAgent executor.
    """
    return agent


def invoke_agent_with_history(message: str, session_id: str) -> str:
    """
    Invoke the agent with conversation history from the session.
    Automatically saves both user message and AI response to history.
    """
    # Get session history
    history = get_session_history(session_id)
    
    # Build messages list with history
    messages = []
    for msg in history.messages:
        messages.append(msg)
    
    # Add current user message
    messages.append(HumanMessage(content=message))
    
    # Invoke agent
    result = agent.invoke({"messages": messages})
    
    # Extract response
    final_response = ""
    if "messages" in result and result["messages"]:
        last_message = result["messages"][-1]
        if hasattr(last_message, 'content'):
            final_response = last_message.content
        else:
            final_response = str(last_message)
    else:
        final_response = str(result)
    
    # Save to history
    history.add_user_message(message)
    history.add_ai_message(final_response)
    
    return final_response


async def stream_agent_with_history(message: str, session_id: str):
    """
    Stream agent response with conversation history.
    Yields chunks as they come in from the agent.
    Saves the complete response to history after streaming completes.
    """
    from langchain_core.messages import AIMessageChunk, HumanMessage
    
    # Get session history
    history = get_session_history(session_id)
    
    # Build messages list with history
    messages = []
    for msg in history.messages:
        messages.append(msg)
    
    # Add current user message
    messages.append(HumanMessage(content=message))
    
    # Save user message immediately
    history.add_user_message(message)
    
    # Collect full response for saving to history
    full_response = ""
    
    async for event in agent.astream_events({"messages": messages}, version="v2"):
        # on_chat_model_stream event yields tokens directly from the LLM
        if event["event"] == "on_chat_model_stream":
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
