import { Client, handle_file } from "@gradio/client";

// This is a 100x100 white square in JPEG
const base64Img = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQICAQECAQEBAgICAgICAgICAQICAgICAgICAgL/wAALCABkAGQBAREA/8QABwAAAQUBAQEAAAAAAAAAAAAAAQIDBAUGBwAI/8QAHwEAAQUAAgMBAAAAAAAAAAAAAAECBAMFBhEHQfD/2gAIAQEAAD8A/QD2r82W1QkQy2rbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/0d+P6y/0n6/1z/m/0v8AK/zj8x/I/wAX/APv+f+p/nP3f9z+B/w//wD/wD8H//EACMQAQEBAAICAwACAwEAAAAAAAERACEBMUFRYXGhwYGR/9oACAEBAAE/EP8AtF//2Q==';

async function checkServer() {
  try {
    const fetchResponse = await fetch(base64Img);
    const blob = await fetchResponse.blob();
    const app = await Client.connect("qdoxmaximaq/manga-translete");
    const result = await app.predict("/predict", [
       handle_file(new File([blob], "test_large.jpeg", { type: "image/jpeg" })), "en"
    ]);
    console.log("Success:", JSON.stringify(result).substring(0, 500));
  } catch (e) {
    console.error("Error direct:", JSON.stringify(e));
  }
}
checkServer();
