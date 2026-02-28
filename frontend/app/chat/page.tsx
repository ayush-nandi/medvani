import ChatInterface from "../../components/ChatInterface";
import RequireAuth from "../../components/RequireAuth";

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatInterface />
    </RequireAuth>
  );
}
