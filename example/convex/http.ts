import { httpRouter } from "convex/server";
import { stripe } from "./stripeInit";

const http = httpRouter();

stripe.addHttpRoutes(http);

export default http;
