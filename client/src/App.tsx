import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Generator from "./pages/Generator";
import History from "./pages/History";
import Prompts from "./pages/Prompts";
import Archive from "./pages/Archive";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <RequireAuth>
          <Generator />
        </RequireAuth>
      </Route>
      <Route path="/history">
        <RequireAuth>
          <History />
        </RequireAuth>
      </Route>
      <Route path="/archive">
        <RequireAuth>
          <Archive />
        </RequireAuth>
      </Route>
      <Route path="/prompts">
        <RequireAuth>
          <Prompts />
        </RequireAuth>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
