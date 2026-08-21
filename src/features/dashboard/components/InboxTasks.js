import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export default function InboxTasks({ tasks = [] }) {
  if (tasks.length === 0) {
    return (
      <Card className="h-full bg-gradient-to-b from-[#090d16] to-[#060913]">
        <CardHeader className="pb-2 border-b border-white/5">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>📥</span> Caixa de Entrada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-[200px]">
          <span className="text-4xl block mb-3 opacity-20">✅</span>
          <p className="text-sm font-bold text-gray-400">Tudo limpo por aqui!</p>
          <p className="text-[10px] text-gray-600 mt-1">Nenhuma pendência ou notificação aguardando ação.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-gray-800 bg-[#090d16]/80 flex flex-col">
      <CardHeader className="pb-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>📥</span> Caixa de Entrada
          </CardTitle>
          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {tasks.length} Pendência{tasks.length > 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[300px] scrollbar-thin">
        <div className="divide-y divide-gray-800/50">
          {tasks.map((task) => (
            <div key={task.id} className="p-4 hover:bg-white/[0.02] transition-colors flex items-start gap-4">
              <div className="text-2xl mt-0.5 opacity-80">{task.icon || "📋"}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-gray-200">{task.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{task.description}</p>
                {task.href && (
                  <Link href={task.href} className={`mt-2 inline-flex min-h-7 items-center rounded-lg border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${task.type === "urgent" ? "border-red-800 bg-red-900/50 text-red-300" : "border-gray-700 bg-gray-800 text-gray-200"}`}>
                    {task.actionText || "Resolver"}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
