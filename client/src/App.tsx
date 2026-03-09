import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Home from "@/pages/Home";
import Assistant from "@/pages/Assistant";
import Checkout from "@/pages/Checkout";
import Payment from "@/pages/Payment";
import PaymentResult from "@/pages/PaymentResult";
import Status from "@/pages/Status";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/payment/result" element={<PaymentResult />} />
        <Route path="/tracking" element={<Status />} />
      </Route>
    </Routes>
  );
}
