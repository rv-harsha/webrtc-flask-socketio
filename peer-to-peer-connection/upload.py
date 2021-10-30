from flask import Flask, render_template, request
from werkzeug.utils import secure_filename
from flask_socketio import SocketIO, emit
from PIL import Image
import cv2
from io import StringIO, BytesIO
import imutils
from ast import literal_eval
import base64
import numpy as np
import json
import torch
import imageio

app = Flask(__name__, static_url_path="/static", static_folder='static')
socketio = SocketIO(app)


@app.route('/', endpoint='load')
def load():
    return render_template('index.html')


@app.route('/upload/video', methods=['POST'], endpoint='upload_file')
def upload_file():
    if request.method == 'POST':
        f = request.files['filepond']
        # f.save('static/'+secure_filename(f.filename))
        f.save('static/tmp/'+secure_filename(f.filename))
        return 'file uploaded successfully'
        

@socketio.on('image')
def image(data_image):
    sbuf = StringIO()
    sbuf.write(data_image)

    # decode and convert into image
    b = BytesIO(base64.b64decode(data_image))
    pimg = Image.open(b)

    # converting RGB to BGR, as opencv standards
    frame = cv2.cvtColor(np.array(pimg), cv2.COLOR_RGB2BGR)

    # Process the image frame
    # frame = imutils.resize(frame, width=700)
    frame = cv2.flip(frame, 1)
    imgencode = cv2.imencode('.jpeg', frame)[1]

    # print("Processing frames ...")
    # stringData = base64.b64encode(imgencode).decode('utf-8')
    # b64_src = 'data:image/jpeg;base64,'
    # stringData = b64_src + stringData
    sample = {
        'jacobian': np.array([[1, 2, 3], [4, 5, 6]], np.float32).tolist(),
        'value' : np.array([[1, 2, 3], [4, 5, 6]], np.float32).tolist()
    }

    data_string = json.dumps(sample)
    stringData = base64.b64encode(bytes(data_string,'UTF-8')).decode()
    emit('response_back', stringData)

@socketio.on('keypoint')
def image(data_image):

    sbuf = StringIO()
    sbuf.write(data_image)

    b = base64.b64decode(data_image)
    dict = literal_eval(b.decode("utf-8"))

    # print(type(dict))
    # print(dict)
    # print(type(dict['jacobian']))
    # print(dict['value'])

    keypoint = {
        'jacobian' : torch.from_numpy(np.array(dict['jacobian'], dtype=np.float32)), 
        'value': torch.from_numpy(np.array(dict['value'], dtype=np.float32)) 
        }


    pimg = Image.open("static/profile.png")

    # converting RGB to BGR, as opencv standards
    frame = cv2.cvtColor(np.array(pimg), cv2.COLOR_RGB2BGR)

    # Process the image frame
    # frame = imutils.resize(frame, width=350)
    # frame = cv2.flip(frame, 1)
    imgencode = cv2.imencode('.jpeg', frame)[1]

    print("Processing frames ...")
    stringData = base64.b64encode(imgencode).decode('utf-8')
    b64_src = 'data:image/jpeg;base64,'
    stringData = b64_src + stringData
    # sample = [{
    #     'test_1': [1, 2, 3, 4, 5],

    #     'test_2': [1, 2, 3, 4, 5, 6, 7, 8],

    #     'test_3': [1, 2, 3, 4, 5, 6, 7, 8, 3232,24345],

    #     'test_4': [1, 2, 3, 4, 5, 6, 7, 8, 3232, 232]
    # }]
    # sample = str(sample).replace(" ", "")
    # print(sample)
    # # Modified Code
    # # base64 encode
    # stringData = base64.b64encode(bytes(sample,'UTF-8')).decode()
    # # b64_src = 'data:plain/text;base64,'
    # # stringData = b64_src + stringData
    img = imageio.imread("static/profile.png")
    # emit the frame back
    emit('final-image', stringData)

if __name__ == '__main__':
    socketio.run(app, host='127.0.0.1')
